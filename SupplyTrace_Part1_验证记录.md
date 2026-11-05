# SupplyTrace Part 1 验证记录

## 环境

验证在临时 PostgreSQL 16.2 实例中完成，操作系统为 macOS arm64。Schema、样例数据、四类查询和完整性检查在同一数据库执行。

## 结果

| 项目 | 结果 |
|---|---|
| Schema 语句 | 74 条，执行成功 |
| 样例数据语句 | 30 条，执行成功 |
| 数据表 | 16 |
| 数据字典字段 | 151 |
| 固定场景事件 | 17 |
| 根事件 | 1 |
| 异常事件 | 5 |
| 最大因果深度 | 10 |

订单 A 返回 11 条事件。事件 215 沿主因果边回溯到事件 201，共 11 个节点。事件 204 的影响查询返回订单 A 和订单 B。订单 B 的最短路径来自 `causal_links` 中事件 204 到事件 216 的贡献边。

## 完整性检查

以下查询均返回零条异常记录：

1. 主因果边没有缺失父事件。
2. 父事件时间不晚于子事件时间。
3. 补充因果边没有自环或时间倒序。
4. 订单行属于所关联订单。
5. 采购行属于所关联采购订单。

负向测试确认数据库拒绝修改事件、写入时间倒序的子事件、添加因果环，以及为同一订单行插入第二条活动承诺。

## 复跑

```bash
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_schema_v1.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_sample_data.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_validation_queries.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_sample_queries.sql
```
