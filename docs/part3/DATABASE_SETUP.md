# 后端启动与数据库准备

要求 Python 3.11+、PostgreSQL 16+（或 Docker Compose）。以下命令在仓库根目录执行，Windows 将 `.venv/bin/python` 换为 `.venv/Scripts/python.exe`。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
docker compose -f compose.part3.yml up -d --wait
cp .env.example .env
```

Docker 使用本机 55433 端口，不占用成员 1/2 现有数据库；默认密码仅供本机开发。可用 PART3_DB_PASSWORD 环境变量覆盖容器密码，并同步 `.env` 的 DATABASE_URL。本机已有 `.env.part3` 不会自动加载，请自行将需要的连接配置写入 `.env`。不要对外暴露开发库。

新建的 compose 默认库名 supplytrace_part3。首次任选固定样例或十万事件初始化（两者选一个）：

```bash
# 小规模开发：成员 2 固定 57 事件
.venv/bin/python -m scripts.setup_part3_db --database-url postgresql://supplytrace:supplytrace@127.0.0.1:55433/supplytrace_part3
# 或十万事件（输出目录必须尚不存在）
.venv/bin/python data_generator.py --seed 5003 --events 100000 --output generated/events-100000
.venv/bin/python -m scripts.setup_part3_db --database-url postgresql://supplytrace:supplytrace@127.0.0.1:55433/supplytrace_part3 --dataset generated/events-100000
```

setup_part3_db 是不依赖本机 psql 的 COPY 导入辅助工具，复用成员 2 的校验清单和 24 项 SQL 检查。只接受尚未初始化的数据库，不覆盖已有库；外键和触发器保持启用，identity 序列同步。schema 初始化与数据导入分事务，导入失败需换新库重试。成员 2 的 `import_data.py` / psql 流程仍可照 README 使用。

本次交付时，本机 compose 的 supplytrace_part3 已导入种子 5003、100,000 事件，不必再次初始化。用于连接它的 `.env` 已在本地创建并被 Git 忽略。

```bash
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

访问 `http://127.0.0.1:8001/docs`、`/redoc` 或 `/health`。默认前端 CORS 为 localhost:3000、localhost:5173，可在 `.env` 中修改 CORS_ORIGINS 的 JSON 数组。

```bash
curl http://127.0.0.1:8001/api/orders/SO-SYN-000001/timeline
curl http://127.0.0.1:8001/api/events/10/root-cause
curl http://127.0.0.1:8001/api/events/3/impact
curl 'http://127.0.0.1:8001/api/analytics/stage-durations?order_line_id=1'
```

每次请求使用连接池中的连接、REPEATABLE READ READ ONLY 事务，保证多个查询看到同一快照。默认单语句超时 15 秒，可由 STATEMENT_TIMEOUT_MS 调整；连接池最大 5 个连接，3 秒取连接超时。失败后事务自动回滚。无需结构 migration：三个必需索引已包含在 schema v1，本次不重复创建。

## 测试与证据重建

```bash
# 无数据库：只跑单元测试
.venv/bin/python -m pytest tests/test_unit.py -q
# 全部测试：需本机 compose 已启动，测试用户有 CREATEDB 权限
.venv/bin/python -m scripts.verify_part3
```

verify_part3 每次创建全新独立测试库，执行单元、接口及真实 PostgreSQL 边界测试，结束仅删除自身刚创建的库。DB 用 DATABASE_URL，缺省为上述本机 compose 库。测试夹具中的异常时间/循环仅发生在回滚事务中，为验证防御逻辑临时关闭 USER 触发器，生产查询不关闭触发器。

亦可 `TEST_DATABASE_URL=... .venv/bin/python -m pytest -q`，但目标必须是**没有 schema 的新测试库**；直接运行 pytest 未设置变量时集成测试明确标记 skipped，不能视为完整验收。

性能评测会在事务中临时移除一个索引再自动回滚，持有表锁，必须只对独立评测库运行。本次 compose 库是独立评测/开发库。数据规模变化请另建库和输出目录。

```bash
.venv/bin/python -m scripts.benchmark_part3 --database-url postgresql://supplytrace:supplytrace@127.0.0.1:55433/supplytrace_part3 --dataset generated/events-100000
.venv/bin/python -m scripts.export_part3 --database-url postgresql://supplytrace:supplytrace@127.0.0.1:55433/supplytrace_part3
```

成员 5 做 50 万/100 万评测时，先用成员 2 生成器生成对应数据，指定新评测库和 `--dataset`，相同脚本即可输出新计划。请另存各规模的 docs/part3/plans，避免覆盖十万档记录。
