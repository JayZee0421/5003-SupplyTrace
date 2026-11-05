# SupplyTrace Part 1 交付说明

本目录对应 Track 1 的 Part 1。范围包括需求、架构、ERD、schema、约束、索引、数据字典、固定样例和查询。

## 文件

| 文件 | 用途 |
|---|---|
| `SupplyTrace_Part1_数据库设计.md` | 需求说明、架构说明、索引说明和报告3-5节初稿 |
| `SupplyTrace_Part1_验证记录.md` | 执行与负向测试记录 |
| `supplytrace_schema_v1.sql` | 完整schema |
| `migrations/001_initial_schema.sql` | 初始迁移 |
| `supplytrace_sample_data.sql` | 固定异常场景 |
| `supplytrace_sample_queries.sql` | 四类查询 |
| `supplytrace_validation_queries.sql` | 完整性检查 |
| `supplytrace_data_dictionary.csv` | 16 表、151 字段字典 |
| `assets/` | 架构图、ERD 和场景图 |

## 载入

在 PostgreSQL 16 开发库执行：

```bash
createdb supplytrace
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_schema_v1.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_sample_data.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_validation_queries.sql
psql -d supplytrace -v ON_ERROR_STOP=1 -f supplytrace_sample_queries.sql
```

`supplytrace_sample_data.sql` 会清空 SupplyTrace 表，只能用于开发库。`supplytrace_schema_v1.sql` 与 `migrations/001_initial_schema.sql` 内容相同，初始化时只执行其中一个。

## 验收值

| 检查项 | 结果 |
|---|---|
| 订单 `SO-2026-1101-A` 时间线 | 11 条事件 |
| 事件 215 根因链 | 11 个节点，最早异常为事件 204 |
| 事件 204 影响范围 | 订单 A 和订单 B |
| 固定场景 | 17 条事件、1 个根事件、5 个异常事件 |
| 最大因果深度 | 10 |

后续结构变更使用新的 migration，并同步更新 ERD、数据字典和 API 模型。

