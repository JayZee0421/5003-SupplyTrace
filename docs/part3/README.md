# 成员 3 后端交付

成员 3 的四类 API、SQL/CTE、契约、mock/真实样例、单元/集成/边界测试及真实查询计划已实现并本地验证。

| 交付 | 入口 |
|---|---|
| 后端与配置 | `backend/main.py`、`config.py`、`db.py`、`service.py` |
| Pydantic 模型 | `backend/contracts.py` |
| 参数化 SQL/递归 CTE | `backend/sql/`，baseline_impact.sql 仅用于评测 |
| 接口契约 | [API_CONTRACT.md](API_CONTRACT.md)、[openapi.json](openapi.json)、schemas/ |
| mock/真实响应 | examples/mock/、examples/real/，四类正常响应加 404/422 |
| 启动与复跑 | [DATABASE_SETUP.md](DATABASE_SETUP.md) |
| 测试记录 | [TEST_RESULTS.txt](TEST_RESULTS.txt)，40 passed |
| 原始样例回归 | [part1_baseline.json](part1_baseline.json) |
| 查询计划与优化 | [PERFORMANCE.md](PERFORMANCE.md)、plans/summary.json 及原始计划 |
| 真实 HTTP 检查 | [HTTP_SMOKE.json](HTTP_SMOKE.json) |

## 验收结果

- 成员 1：时间线 11 条、根因链 11 节点、最早异常 204、影响 A/B；17 事件、1 根节点、5 异常、最大深度 10，均通过。
- 成员 2：根因 3/23/46 分别影响订单 1–2/3–4/5–6，根因链与 benchmark_cases.json 完全相同；57 事件集成测试和十万事件评测均通过。
- 耗时：使用 Python 独立重算均值、P90 插值并与 SQL 比较，覆盖失败质检后复检、零值、缺失、负值、未完成和时间窗口。
- 图边界：主边环、补充边混合环、64 层截断、无上下游、多分支、菱形汇合、重复类型边、空结果和同时间稳定排序均通过。
- 服务：只读一致性快照、语句超时、错误信息脱敏、CORS、Swagger 与 OpenAPI 均验证。测试环境有一条 Starlette 对 httpx 的弃用提示，不影响 40 项测试通过。

数据库三类必需索引已由成员 1 提供，本次通过真实计划验证使用情况，并在回滚事务中测量移除各索引的性能，没有新增重复 migration。性能结论范围仅为本机十万事件暖缓存单查询；50 万/100 万档可用同一脚本交给成员 5 复跑。

尚需小组协作确认：成员 4 依此契约接入并完成前端联调；成员 1/5 接收技术说明和评测材料。未发送外部消息、未替组员确认，未自动提交或推送 Git。
