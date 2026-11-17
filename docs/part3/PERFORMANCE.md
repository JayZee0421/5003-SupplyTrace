# 查询计划与优化对比

实测日期：2026-11-17（香港）。数据库：PostgreSQL 16.16，Docker / aarch64；Python 3.12。数据：成员 2 生成器，seed=5003，100,000 事件、10,989 订单/订单行；24 项数据检查均通过。manifest SHA-256：`afe3946381fad594572cd997c26d3f63c966a9380cb7d5f4e1acab0fd6c0d7c6`。

运行 `python -m scripts.benchmark_part3 --database-url <独立评测库> --dataset generated/events-100000` 可复跑。原始五次 `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` 均保存在 plans/*.json，汇总和参数见 [plans/summary.json](plans/summary.json)。每个查询预热一次后测五次，表中为执行时间中位数，单位毫秒。未禁用顺序扫描，未强制索引。

## 四类核心 SQL

| SQL | 执行时间 ms | 代表性 shared hit blocks | 主要索引 |
|---|---:|---:|---|
| timeline | 0.005 | 4 | idx_events_order_time |
| root_cause | 0.018 | 30 | supply_chain_events_pkey |
| impact | 0.085 | 149 | idx_events_caused_by, supply_chain_events_pkey |
| stage_durations | 106.784 | 2893 | 顺序扫描 |

参数：timeline order_id=1；root_cause event_id=10；impact event_id=3；递归上限 64；stage_durations 无筛选。时间线表中只测 timeline.sql 取 ID，节点详情另由 events.sql 查询；影响表中测包含邻接边的 impact.sql。以上均非 HTTP 端到端延迟，不包括连接、模型序列化和影响订单整理。全库阶段统计需处理所有事件，采用顺序扫描/聚合符合其低选择性访问模式，不应强制索引。补充边仅 3 行，规划器可合理选择顺序扫描。

## 三类索引隔离对比

每次仅在自动回滚事务中 DROP 一个目标索引，比较同一查询移除前后的结果，均一致；最终三个索引保留。未改变 schema v1，无需新增重复索引 migration。

| 索引 | 无目标索引 ms | 有目标索引 ms | 返回行 | 无/有索引 shared hit |
|---|---:|---:|---:|---:|
| idx_events_caused_by | 4.964 | 0.003 | 1 | 2368 / 4 |
| idx_events_entity_time | 4.345 | 0.011 | 50 | 2368 / 4 |
| idx_events_type_time | 3.176 | 0.012 | 50 | 2368 / 4 |

探针：caused_by_event_id=3；entity_type=SUPPLIER、entity_id=2、event_time>=2026-01-01 UTC，倒序取 50 条；event_type_code=SUPPLIER_DELAYED、同一时间下限，倒序取 50 条。SQL 在 plans/caused_by.sql、entity_time.sql、type_time.sql。有索引计划实际出现各自目标索引；非空返回保证不是对不存在主体的空查。

## 正向递归 SQL 优化

| 对比 | ms | shared hit blocks |
|---|---:|---:|
| 成员 1 原始遍历 | 70.960 | 2401 |
| 成员 3 优化遍历 | 0.052 | 76 |

两者均从事件 3 出发，返回同一组 event_id、最短跳数，脚本先断言结果完全相同。比较范围仅为遍历，未把额外返回边、订单字段计入优化收益。原始 SQL 保留在 backend/sql/baseline_impact.sql，来自成员 1 样例，改为参数化并输出最短节点；优化版见 plans/traversal_after.sql，与线上 impact.sql 使用同一递归部分。

原查询先构建全库主边与补充边的 UNION，计划需处理大规模边集合；优化版把父节点条件下推至参数化 LATERAL 子查询，逐节点利用 idx_events_caused_by，补充边使用已有主键访问路径或小表扫描。递归状态由完整路径改为 (event_id,steps) 并用 UNION 去重，同层多路径汇合不会重复扩展；深度最大 64，即使有环也有有限状态上限。返回图后用排序 BFS 重建确定性最短路径，用 Kahn 算法检测已返回子图的环，避免 Python 递归栈限制。

## 结论边界

这些结果是单机暖缓存、固定参数的 PostgreSQL 执行时间；多数 shared read=0。不能据此推断生产 SLA、并发吞吐、冷缓存或 50 万/100 万数据表现。完整服务默认 15 秒单语句超时；此评测为保留基线允许 120 秒。benchmark 脚本会持有表锁，禁止对共享业务库运行。

三个已知场景在十万档均再次断言通过：供应商延期 3 → 订单 1/2；质检失败 23 → 订单 3/4；运输中断 46 → 订单 5/6。根因链均为成员 2 指定的十个主链节点。完整场景值见 summary.json。
