# SupplyTrace API v1 契约

基线：成员 1 schema v1、成员 2 benchmark_cases.json。本文及 Pydantic 模型为成员 3 交付，待成员 4 实际联调确认。完整机器契约为 [openapi.json](openapi.json)，运行后访问 `/docs`、`/redoc`、`/openapi.json`。字段以 `backend/contracts.py` 为唯一模型源，不省略可空字段。

## 路径与请求

| GET 路径 | 参数 | 200 响应模型 |
|---|---|---|
| `/api/orders/{order_number}/timeline` | 非空订单号，最长 100 字符 | Timeline：order_number、count、events |
| `/api/events/{event_id}/root-cause` | 正整数 BIGINT；max_depth=64，范围 0–64 | RootCause：Graph 加 earliest_exception_event_id、chain_start_event_id |
| `/api/events/{event_id}/impact` | 同上 | Impact：Graph 加 affected_order_count、orders |
| `/api/analytics/stage-durations` | 可选 order_number、order_line_id、start_time、end_time | Durations：回显筛选条件，stages |
| `/health` | 无 | `{"status":"ok"}`，会实际检测 DB |

时间参数必须带时区；start_time 必须早于 end_time。数据库事件时间返回 UTC ISO 8601；承诺日期是 `YYYY-MM-DD`。小时统计保留两位小数，JSON 数值不保证显示末尾的零。ID 为 JSON integer，当前合成数据可安全用于 JavaScript；若未来超过 JavaScript 安全整数，需升级契约处理大整数。

## Event 与图结构

Event 的必有字段：event_id、event_type_code、event_name、event_time、status、is_exception、entity_type、entity_id、subject_entity、causal_depth。可为 null 但始终存在：location_id、location_name、order_id、order_line_id、caused_by_event_id、message、current_commitment。current_commitment 只取该订单行 `ACTIVE` 版本，无 ACTIVE 时为 null，不回退至历史承诺。异常依据事件自身 status 为 WARNING/FAILED，不根据事件类型默认状态判断。

Graph 含 selected_event_id、max_depth、count、nodes、edges、truncated、cycle_detected。nodes 为 Event 加 steps 与 path。选中事件计入 nodes，steps=0、path=[自身 ID]；max_depth=0 只返回源事件。count 是去重后的节点数。

- nodes 按 event_time、event_id 升序；时间相同时 ID 决定顺序。
- steps 是从选中事件出发的最短跳数，独立于表中历史 causal_depth。
- path 是从选中事件开始的一个最短路径。影响查询在多条等长路径中按 ID 升序 BFS 选择，重复执行稳定；不枚举所有路径。
- edges 含 cause_event_id、effect_event_id、kind，方向始终为原因 → 结果；按这三个字段升序。kind 为 PRIMARY、CONTRIBUTING、ALTERNATIVE、CORRECTIVE。
- 相同端点的主边和补充边保留不同 kind；重复节点、重复订单和重复订单行均去重。
- truncated 表示存在受深度限制而未返回的可达节点。仅到达深度上限但没有遗漏节点时为 false。
- cycle_detected 表示返回子图中实际观察到有向环；不是整库无环证明。深度外可能存在未知环，需结合 truncated 判断完整性。

根因只沿 `caused_by_event_id` 上溯，path 从选中事件往祖先排列，edges 仍按原因 → 结果排列。earliest_exception_event_id 是返回节点中按时间、ID 最早的异常；它是“最早可观察异常”，不声称为现实业务的唯一根因。截断时可能尚未找到更早异常。无异常时 null。chain_start_event_id 是已返回且父 ID 为 null 的链起点；有环或未遍历到起点时 null。

影响沿主边和 causal_links 所有类型正向遍历。源事件本身关联的订单也计入，故无下游时 nodes 为源节点、edges 为空，orders 可能非空。orders 按 order_number、order_id 排序；每个订单含 order_id、order_number、customer_name、lines。lines 仅含被访问事件涉及的订单行，按 line_number、order_line_id 排序，含当前承诺及 latest_affected_event_id/time。causal_hops 是到该行最新受影响事件的最短跳数。仅关联订单、未关联订单行的事件也纳入订单，lines 可为空；没有订单关联的事件可得到 orders=[]。

## 耗时口径

保留成员 1 的八阶段顺序及英文名称，stage_order 为 1–8。每个订单行、每种阶段事件取最早发生时间；质检只取 status=NORMAL 的通过事件，失败检查不作为通过时间。按相邻阶段相减计算小时数。缺一端或负耗时的阶段不纳入该阶段样本；零耗时纳入。未完成订单的已完成阶段仍参与统计。

order_number、order_line_id 同时出现时取交集。时间窗口 `[start_time,end_time)` 筛选存在 ORDER_CONFIRMED 事件的订单行，保留该行全生命周期事件，避免窗口切断阶段时间对；无时间筛选时不要求存在确认事件。每个阶段 sample_lines 是有效订单行数，average_hours 为均值，p90_hours 使用 PostgreSQL percentile_cont(0.9) 线性插值。始终返回八行；零样本时 count=0、两个统计值为 null。

## 错误与空结果

统一响应：`{"error":{"code":"NOT_FOUND","message":"Event does not exist"}}`。

| HTTP | code | 含义 |
|---|---|---|
| 404 | NOT_FOUND | 显式指定的订单、订单行或事件不存在 |
| 422 | VALIDATION_ERROR | 参数非法、无时区、时间区间反向 |
| 503 | DATABASE_UNAVAILABLE | 连接失败或连接池不可用 |
| 504 | QUERY_TIMEOUT | 数据库语句超过超时 |
| 500 | INTERNAL_ERROR | 其他内部错误，不暴露 SQL、凭据、堆栈 |

存在的订单无事件：200、events=[]。存在但筛选后无耗时样本：200、八阶段零样本。不存在的订单号/订单行即使与其他筛选交集为空，仍返回 404。

[examples/mock](examples/mock) 是可直接用于前端 mock 的固定 JSON 快照；[examples/real](examples/real) 为十万事件库通过完整 FastAPI 路由/Pydantic 序列化捕获的真实响应。mock 由同一已验证响应生成，无需 DB，字段和值与真实快照一致。示例采用根因事件 10、影响源 3、订单 SO-SYN-000001，全库阶段统计；四类正常响应及 404、422 各有一份。数据库故障及超时响应通过自动化测试验证。
