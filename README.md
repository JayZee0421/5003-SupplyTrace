# SupplyTrace 本地开发数据

## Part 2 合成数据

需要 Python 3.11+、PostgreSQL 16+ 和 `psql`。在仓库根目录执行以下命令，使用独立的开发库。

```bash
python data_generator.py --seed 5003 --events 100000 --output generated/events-100000
createdb supplytrace_generated
psql -d supplytrace_generated -v ON_ERROR_STOP=1 -f supplytrace_schema_v1.sql
python import_data.py generated/events-100000 --dbname supplytrace_generated
```

生成器接受以下规模，建议验收时统一用 `--seed 5003`。输出目录须为新目录。`generated/` 中的大文件可用生成命令重建。

| `--events` | 用途 | 建议输出目录 |
|---:|---|---|
| `100000` | Part 2 里程碑用数据 | `generated/events-100000` |
| `500000` | 50 万事件数据 | `generated/events-500000` |
| `1000000` | 100 万事件数据 | `generated/events-1000000` |
| `57` | 单独重建固定评测数据 | `generated/benchmark-57` |

仓库随附 [57 条固定评测数据](benchmark_data/manifest.json)。在已初始化 schema 的空测试库中，直接执行 `python import_data.py benchmark_data --dbname supplytrace_generated` 即可导入。

同一 Python 版本下，相同种子和规模产生相同的 CSV 和清单。导入使用 schema 的外键和触发器，验证通过后才提交数据库事务。默认只接受空库。重跑同一独立开发库时，可以显式传入 `--replace` 清空并替换 SupplyTrace 表。只运行已导入数据的检查时，传入 `--validate-only`。连接参数可通过标准 `PG*` 环境变量或 `--dbname` 连接串设置。`psql` 不在 PATH 时可传入 `--psql`。

见 [合成数据字典](data_dictionary.md)、[固定评测场景](benchmark_cases.json) 和 [数据质量报告](data_quality_report.md)。

## Part 1 数据库设计

Part 1 文件涵盖 Track 1 的需求、架构、ERD、schema、约束、索引、数据字典、固定样例和查询。

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

