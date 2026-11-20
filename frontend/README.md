# SupplyTrace 前端

成员 4 交付：React + TypeScript + Recharts 前端，覆盖四个核心视图、真实 API 对接、深链、加载/空/错误状态和演示入口。首页打开即汇总种子订单的最新异常，而不是固定展示第一条订单。

## 技术栈

- React 19 + TypeScript（`tsc --noEmit` 严格检查）
- Vite 8 开发服务器与构建
- React Router 7（深链）
- Recharts 3（平均 / P90 耗时图）
- Inter Variable / JetBrains Mono（本地字体，无外部请求）
- 视觉方向：Precision Dark —— 中性石墨表面、发丝边框、单一蓝色强调色；Normal 用绿色、Warning 用琥珀、Failed 用红，蓝色只做交互强调；Inter Variable + JetBrains Mono；6/8px 圆角

## 启动

前端默认通过 Vite 代理把 `/api` 和 `/health` 转到 `http://127.0.0.1:8001`，因此先按 [Part 3 启动说明](../docs/part3/DATABASE_SETUP.md) 准备数据库并启动后端，再：

```bash
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`。后端 `http://127.0.0.1:8001/docs` 可用时，右上角显示 `API live`。

生产构建与本地预览：

```bash
npm run build
npm run preview
```

`vite preview` 同样带 `/api`、`/health` 代理（端口 4173）。构建产物在 `frontend/dist/`，由成员 5 的 Docker/部署流程托管；部署到其他 origin 时需设置 `VITE_API_BASE` 或在反向代理中转发 `/api`，静态托管还需要 SPA fallback 到 `index.html`。

### 环境变量

复制 `.env.example` 为 `.env.local`（已被 Git 忽略）：

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `VITE_API_BASE` | 空 | 后端 origin。留空表示使用 Vite 开发代理；部署时填后端地址 |
| `VITE_BACKEND_URL` | `http://127.0.0.1:8001` | Vite 开发/预览代理的目标，只用于本地开发，不进入浏览器包 |
| `VITE_USE_MOCK` | `false` | `true` 时使用内置 fixtures，不请求 API |
| `VITE_DEV_PORT` | `5173` | Vite 开发服务器端口 |
| `VITE_PREVIEW_PORT` | `4173` | Vite preview 服务器端口 |

Mock 模式只包含供应商延期路径（订单 `SO-SYN-000001` / `SO-SYN-000002`、根因事件 `#10` / `#3`、影响事件 `#3`、未筛选的八阶段耗时快照），用于后端未启动时检查界面。耗时筛选在 mock 模式下会返回说明性错误；其余场景返回 404。

## 路由与视图

| 路由 | 视图 | 数据来源 |
| --- | --- | --- |
| `/` | 总览、订单搜索、最新异常、三个基准场景入口、演示路径 | 静态配置 + 六个种子订单的时间线（客户端汇总） |
| `/orders/:orderNumber` | 事件时间线（最新在上） | `GET /api/orders/{orderNumber}/timeline` |
| `/events/:eventId/root-cause` | 根因追溯链 | `GET /api/events/{eventId}/root-cause?max_depth=64` |
| `/events/:eventId/impact` | 影响传导图 + 受影响订单 | `GET /api/events/{eventId}/impact?max_depth=64` |
| `/durations?order_number=&order_line_id=&start_time=&end_time=` | 八阶段平均 / P90 耗时 | `GET /api/analytics/stage-durations` |

所有选择都在 URL 里，可直接深链；耗时筛选条件从 URL 读写，开始/结束时间以本地时间输入、按 UTC 发送。

## 演示路径

基准数据来自仓库根目录的 `benchmark_cases.json`。57 条固定数据与 10 万事件数据的编号一致：

0. 打开首页：`Latest exceptions` 汇总六个种子订单里最新的 6 条 WARNING/FAILED，hero 链接指向其中最新一条（`#57`）。api 没有全局事件列表接口，所以这里的“最新”限定在种子演示订单内。
1. 打开 `SO-SYN-000001` 时间线：顶部是最新的 `#10 DELIVERY_SIGNED`（WARNING），向下依次是 `#3 SUPPLIER_DELAYED`（WARNING）和 `#1 ORDER_CONFIRMED`。
2. 从事件 `#10` 追溯根因：返回 `#1 → #10` 的主链，最早异常为 `#3`。
3. 打开事件 `#3` 的影响：受影响订单 `SO-SYN-000001`、`SO-SYN-000002`，含订单行、当前承诺与跳数。
4. 打开耗时视图：八个阶段的平均值与 P90，可按订单、订单行、时间窗口筛选。

另外两个场景同样可直接演示：

| 场景 | 异常事件 | 追溯起点 | 影响订单 |
| --- | --- | --- | --- |
| 供应商延期 | `#3` | `#10` | `SO-SYN-000001` / `SO-SYN-000002` |
| 质检失败 | `#23` | `#29` | `SO-SYN-000003` / `SO-SYN-000004` |
| 运输中断 | `#46` | `#48` | `SO-SYN-000005` / `SO-SYN-000006` |

## 界面约定

- 时间统一按 UTC 显示并标注 `UTC`；耗时单位为小时，保留两位小数。
- 订单时间线按最新事件在上、最早事件在下排列，顶部事件带 `Latest` 标签，并在列表上方标注 `Newest first`；根因链保持最早原因在上、选中事件在下，面板标注 `Causal order, not recency`，两者方向不同。
- 首页右侧预览固定展示供应商延期演示场景（订单 `SO-SYN-000001`），标题为 `Demo preview · Supplier delay`，用于演示完整因果链；最新异常由 hero 链接和 `Latest exceptions` 面板承担，两者职责不同。
- 状态同时用颜色、图标和文字表达；根因/影响图的边方向始终是原因 → 结果，四种边类型用颜色和线型区分。
- 搜索框非法输入给出 inline 提示；路由内渲染错误由 `ErrorBoundary` 兜底，页头和导航仍可用。
- 事件 ID、订单号、订单行号使用等宽字体；数字列使用 tabular figures。
- 加载时保留旧画面（不闪骨架）；404/422/503/504 分别给出说明与重试入口。
- 1920×1080 下列表、图表和 8 列影响图无文字截断；窄屏下时间线行、筛选表单和 metrics 条自动堆叠，最新异常表改为三行卡片式布局，场景表改为分行显示，影响图可横向滚动（容器可键盘聚焦）；375 宽度下导航五项完整显示，首页标题与预览不截断。
- 窄屏最新异常表为每个单元格提供隐藏列名（Event / Order / Status / Time / Open），读屏不会丢失字段含义；首页同一订单的时间线请求在预览、demo readiness 和最新异常面板之间合并为一次。
- 右上角 `Display` 菜单提供 `Color vision` 四档：`Standard`、`Red-green safe`（蓝/橙/品红）、`Blue-yellow safe`（绿/朱红/品红）、`Monochrome`（整页灰度 + 明度层级 + 圆/方/菱形/空心标记）；菜单内 `Status markers` 图例用颜色和文字标出 Normal/Warning/Failed/Completed/Cancelled，Monochrome 下同一图例显示对应形状。另有 `High contrast` 和 `Reduce motion`。偏好写入 localStorage，状态仍带图标与文字标签。
- 根因页 Event context 的 Order / line 优先显示订单号（基准场景映射或 `?order=` 上下文），只有未知事件才退回内部 `#id`；从受影响订单打开导航时，Root cause / Impact 指向该场景的根因事件。
- 影响图在每条订单 lane 的起始卡片上方标注订单号，并在面板说明中按自上而下列出订单，长图滚动时也能从起点识别每条链。
- 最新异常表在订单号下显示客户、在时间下显示承诺日期，便于先按客户和承诺做分诊；耗时页主指标为 `Slowest P90`，平均值保留在副文案和图表中。P90 柱使用斜纹填充，Average 保持实心，颜色之外还有纹理可区分。
- 导航以 `sessionStorage` 记住最近一组有效上下文（查看的订单、事件及其所属订单）；回到 Overview/Durations 后仍指向它，导航的 Root cause / Impact 也带 `?order=`。从事件进入某订单的时间线后，该订单的 Root cause / Impact 继续使用刚看过的事件，不会退回场景根事件；直接打开订单时由时间线发布该订单最新异常作为导航锚点。首次打开仍使用 demo 默认值。
- 导航不绑定具体订单号或事件号：订单页锚点来自时间线响应，事件页来自 URL/接口；`DEMO_ORDER_NUMBERS`、场景映射和 `DEFAULT_*` 只是 `demo.ts` 里的演示配置。接入真实订单时，把服务端订单列表传给 `useRecentExceptions(orderNumbers)`，并替换这些默认值即可。事件/根因响应目前只有 `order_id`；若要让不带 `?order=` 的真实事件深链显示订单号，后端响应需补 `order_number`（或提供事件→订单查询）。
- 界面文案、代码注释和属性文案全部使用英文；日期/数字输入使用英文文本框，不依赖浏览器本地化的原生控件文案。仓库 README 按团队习惯使用中文。

## 目录

```text
frontend/
  src/
    api/client.ts         # fetch 封装、错误信封、mock 路由
    hooks/useApi.ts       # 可取消请求、重载时保留旧数据
    types.ts              # 与 backend/contracts.py 对齐的响应类型
    lib/format.ts         # UTC、小时、数字格式
    lib/theme.ts          # 系列色与边类型色
    components/           # 布局、状态、时间线卡、因果链、影响图、耗时图
    pages/                # 总览、时间线、根因、影响、耗时、404
    mocks/                # docs/part3/examples/mock 的副本
  .env.example
  package.json
  vite.config.ts
```

## 验证记录

- `npm run typecheck` 通过。
- `npm run build` 通过。
- `npm test` 通过：8 个测试文件、43 项测试（ID 解析、日期解析、阶段统计、图深度/选中节点、演示场景与 `benchmark_cases.json` 对齐、最新异常排序、时间线倒序、导航上下文解析与持久化、时间线请求合并与单调用方取消、网络/503 重试与 404 不重试）。
- 四个视图与供应商延期路径已在本机真实 FastAPI + PostgreSQL 上逐页截图检查（1920×1080、1280、768、512、375 宽度）；另外两个基准场景的接口返回值经 API 验证。
- 在 100,000 事件库（seed 5003，10,989 订单）上复测：基准场景的订单时间线、根因链、影响节点数和受影响订单与 57 事件库完全一致；耗时页显示 10,989 个样本（P90 15.43 h / 平均 13.06 h）；随机订单 `SO-SYN-010989` 和随机事件 `#38546` 可正常深链；1280/375 无控制台错误或横向溢出。
- 路由级代码分割：主包 294.9 kB（gzip 92.7 kB），耗时页 378.6 kB（gzip 109.1 kB，含 Recharts）。
- 数据 GET 请求对网络错误和 502/503/504 自动重试一次（约 300 ms 后）；懒加载 chunk 失效时 `ErrorBoundary` 会自动刷新一次，避免开发期 HMR 或部署切换留下错误页。503/504 错误页已用受控响应拦截截图验证，错误码与 HTTP 状态均来自统一信封。
- API 契约与错误码以 [docs/part3/API_CONTRACT.md](../docs/part3/API_CONTRACT.md) 为准；字段未在前端猜测或改名。
