# SupplyTrace Part 2 数据字典

字段类型、空值、约束与主外键以 [schema v1](supplytrace_schema_v1.sql) 和 [Part 1 字段字典](supplytrace_data_dictionary.csv) 为准。本文说明合成数据的取值和关联规则。

## 数据文件

生成器输出 UTF-8 CSV（含表头，空字段导入为 SQL NULL）和 `manifest.json`。清单记录数据格式版本、种子、目标事件数及各表的行数与 SHA-256。所有业务编号带 `SYN`，时间为 UTC，单位为件，金额使用 schema 的默认币种 CNY。

| 表 | 生成规则 |
|---|---|
| `entities`、`locations`、`items` | 6 个主体、5 个地点、2 种物料。其中 2 个客户交替下单。 |
| `orders`、`order_lines` | 每个客户订单 1 行，订购成品。原定签收日期写入 `required_date`。 |
| `purchase_orders`、`po_lines`、`purchase_line_allocations` | 每个订单行对应一条原料采购及分配。原料采购数量等于分配数量和成品数量。 |
| `production_orders`、`shipments`、`shipment_lines` | 每个订单行对应一张工单、一票发运和一条发运行。工单与发运保存计划和实际时间。 |
| `delivery_commitments` | 每行有一条当前承诺；延期时原版本标为 `SUPERSEDED`，当前版本指向原版本，签收引用当前版本。 |
| `event_types` | 使用 Part 1 样例的 11 种事件类型及默认状态。 |
| `supply_chain_events` | 每个订单行有 9 个基准事件。注入直接异常的订单多 1 个事件。固定场景中第二个订单保留 9 个事件，从补充因果边接收影响。 |
| `causal_links` | 每组固定场景贡献 1 条 `CONTRIBUTING` 边，由首个订单的异常指向第二个订单恢复处理的阶段。 |
| `audit_log` | 由 schema 的审计触发器在导入时生成。审计时间取导入时钟。 |

## 事件字段

| 字段 | 含义 |
|---|---|
| `event_id` | 从 1 开始分配的拓扑序号。因果边始终指向更大的序号；跨独立订单的事件时间可交错。 |
| `event_time`、`recorded_at` | 业务发生时间与模拟记录时间，后者比前者晚 1 分钟。 |
| `order_id`、`order_line_id` | 所有事件均关联同一订单及其订单行，便于计算阶段耗时。 |
| `purchase_order_id`、`po_line_id` | 采购、供应商确认及质检阶段关联采购记录。 |
| `production_order_id`、`shipment_id`、`delivery_commitment_id` | 生产事件关联工单，发运至签收阶段关联发运，签收事件另关联交付承诺。 |
| `caused_by_event_id`、`causal_depth` | 主因果父 ID 为空时表示订单确认根节点。非空时指向该订单行的前一个事件。深度由 PostgreSQL 触发器计算。 |
| `status` | 基准阶段使用事件类型的默认状态。失败质检为 `FAILED`，供应商延期、运输中断及逾期签收为 `WARNING`。使用事件状态判定异常。 |
| `payload` | 质检阶段含 `lot`。直接异常额外含 `scenario` 和 `delay_minutes`。 |

基准链依次为 `ORDER_CONFIRMED` → `PURCHASE_CREATED` → `SUPPLIER_CONFIRMED` → `QUALITY_CHECK`（`NORMAL`）→ `PRODUCTION_STARTED` → `PRODUCTION_COMPLETED` → `SHIPMENT_DISPATCHED` → `SHIPMENT_ARRIVED` → `DELIVERY_SIGNED`。阶段耗时查询使用通过的质检。失败和复检使用同一事件代码，并通过状态区分。

## 固定评测场景

前 57 条事件组成固定子集，覆盖 6 个订单。各档规模、各随机种子的子集一致。仓库随附可直接导入的 [benchmark_data](benchmark_data/manifest.json)，用 `--events 57` 也可单独生成。每组从第一个订单的逾期签收沿主链回溯，可取到最早的异常；从异常沿主边和补充边正向遍历，可取到两个订单的签收。具体节点与顺序见 [benchmark_cases.json](benchmark_cases.json)。

| 场景 | 注入及恢复 | 异常事件 | 从该签收回溯 | 补充边终点 | 影响订单 |
|---|---|---:|---:|---:|---|
| 供应商延期 | 延期预警后推迟供应商确认 | 3 | 10 | 13 | `SO-SYN-000001`、`SO-SYN-000002` |
| 质检失败 | 首检 `FAILED`，复检 `NORMAL` | 23 | 29 | 33 | `SO-SYN-000003`、`SO-SYN-000004` |
| 运输中断 | 发运后中断，之后恢复运输并到达 | 46 | 48 | 56 | `SO-SYN-000005`、`SO-SYN-000006` |

每个直接异常推迟对应恢复阶段及后续阶段 36 小时。其余订单使用指定种子决定阶段时长、交易数量和约 10% 的直接异常分布。
