# SupplyTrace

## Part 5 Docker Quick Start

SupplyTrace是一个基于PostgreSQL、FastAPI和React的供应链事件因果溯源系统。本节介绍如何使用Docker Compose在本地启动完整应用，包括数据库、后端API和前端可视化界面。

### 1. Requirements

- Docker Desktop（包含Docker Compose）
- 可用端口：55433、8002、5174
- 首次构建需要网络连接以下载Docker镜像及项目依赖

以下命令均在项目根目录执行。

### 2. Start Services

```bash
docker compose up -d --build
```

该命令构建并启动三个服务：

| Service | Technology | Local Address |
|---|---|---|
| Frontend | React + Vite | http://127.0.0.1:5174 |
| Backend | FastAPI | http://127.0.0.1:8002 |
| API Documentation | Swagger UI | http://127.0.0.1:8002/docs |
| PostgreSQL | PostgreSQL 16 | 127.0.0.1:55433 |

检查容器状态：

```bash
docker compose ps
```

PostgreSQL使用Docker命名卷`part3_pgdata`持久化数据。停止或重新构建容器不会自动删除该卷。

### 3. Initialize Demo Database

**仅首次启动全新数据库时执行以下命令。**

```bash
docker compose exec -T backend python -m scripts.setup_part3_db --database-url postgresql://supplytrace:supplytrace@postgres:5432/supplytrace_part3
```

初始化脚本将：

1. 检查Schema、验证SQL及数据文件是否存在。
2. 校验CSV文件的SHA256、表头和预期行数。
3. 创建SupplyTrace的16张关系表。
4. 导入随仓库提供的57条固定演示事件及关联数据。
5. 执行数据验证。

脚本会拒绝初始化已经包含SupplyTrace Schema的数据库，不会主动清空或替换已有数据。

**注意：**如果设置了`PART3_DB_PASSWORD`，初始化命令中的数据库密码也需要相应调整。

初始化过程中如果出现错误，请先检查日志和数据库状态。不要直接删除Docker Volume或对已有数据库重复初始化。

### 4. Open the Application

完成初始化后，在浏览器访问：

**Frontend：** http://127.0.0.1:5174

演示功能包括：

- Overview：查看订单及最新异常事件。
- Order Timeline：查看订单事件时间线。
- Root Cause：递归追溯异常事件的上游因果链。
- Impact Analysis：分析异常事件影响的下游事件及订单。
- Stage Durations：查看各业务环节的平均耗时和P90耗时。

演示数据使用57条固定事件，与Part 2的100k、500k、1m性能评测数据集相互独立。

### 5. Health Check

检查后端健康状态：

```bash
curl http://127.0.0.1:8002/health
```

查看容器日志：

```bash
docker compose logs --tail=100 backend
```

前端通过Docker网络访问Backend，并使用Vite开发代理转发API请求。

当前Docker配置用于本地开发和课程演示，前端运行的是Vite Development Server，而非生产环境静态文件服务器。

### 6. Tests and Benchmarks

项目已完成以下测试和评测：

| Category | Result |
|---|---|
| Backend automated tests | 40 passed |
| Frontend automated tests | 53 passed |
| API smoke tests | 10 passed |
| HTTP integration checks | 9 passed |
| Data quality checks | 24/24 at each dataset scale |
| Benchmark scales | 100k / 500k / 1m events |

详细结果：

- [Backend测试记录](docs/part3/TEST_RESULTS.txt)
- [测试总结](docs/part3/TEST_SUMMARY.md)
- [性能评测总结](docs/part3/BENCHMARK_SUMMARY.md)
- [查询计划与索引分析](docs/part3/PERFORMANCE.md)
- [Frontend测试及使用说明](frontend/README.md)

前端自动化测试可在`frontend`目录执行：

```bash
npm ci
npm test
```

性能评测使用独立的PostgreSQL数据库，不应在演示数据库中直接运行数据替换或清空操作。

### 7. Stop Services Safely

停止服务并保留数据库：

```bash
docker compose down
```

重新启动：

```bash
docker compose up -d
```

**不要使用`docker compose down -v`清理演示环境。** `-v`会删除Compose管理的数据库命名卷，可能造成已有数据丢失。

---

## Part 4 前端与可视化

React + TypeScript 前端，包含订单时间线、根因追溯、影响传导和环节耗时四个视图，首页打开即汇总种子订单的最新异常，全部读取 Part 3 的真实 API。启动、环境变量、路由和演示路径见 [前端说明](frontend/README.md)。

```bash
cd frontend
npm install
npm run dev
```

开发服务器默认将 `/api`、`/health` 代理到 `http://127.0.0.1:8001`。后端未启动时可设置 `VITE_USE_MOCK=true` 使用供应商延期场景的固定响应。演示分镜见 [docs/part4/VIDEO_STORYBOARD.md](docs/part4/VIDEO_STORYBOARD.md)。

## Part 3 后端与核心查询

已完成四类 FastAPI API、递归图查询、响应模型、错误处理及测试。详见 [成员 3 交付入口](docs/part3/README.md)、[启动说明](docs/part3/DATABASE_SETUP.md)、[API 契约](docs/part3/API_CONTRACT.md)、[查询计划对比](docs/part3/PERFORMANCE.md)。

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
# 先按启动说明配置 .env 并初始化独立 PostgreSQL 开发库
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Swagger：`http://127.0.0.1:8001/docs`。完整回归：`.venv/bin/python -m scripts.verify_part3`（需可创建独立测试库的本机 PostgreSQL）。本次 40 项测试通过；十万事件的 24 项数据检查通过。

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

