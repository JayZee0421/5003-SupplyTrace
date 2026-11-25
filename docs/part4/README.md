# 成员 4 交付：前端与可视化

SupplyTrace 前端（React + TypeScript + Recharts）已完成四个核心视图、真实 API 对接、深链、空/错状态和演示入口；首页打开即汇总种子订单的最新异常。代码与运行说明见 [frontend/README.md](../../frontend/README.md)。

## 课程评分对应

课程课件（`DSC5003_1introduction&ER.pdf`）的总评分为源码 30%、视频 20%、报告 50%，与分工表里的成员占比是两套口径。本部分为课程交付提供：

| 课程交付 | 占比 | 本部分可提供的材料 |
| --- | --- | --- |
| Source Code | 30% | React 前端源码、API 对接层、`frontend/README.md` 运行说明 |
| Video Demonstration | 20% | 前端 3-4 分钟分镜、四个视图的真实接口演示；最终视频按课程要求 8-10 分钟，并覆盖查询执行/数据流/后端操作 |
| Written Report | 50% | Technical Design 的前端架构与路由、Evaluation 的可用性证据、四视图截图与演示路径 |

报告和最终视频由成员 5 统筹；本目录的截图与分镜可直接引用。注意课程要求视频 8-10 分钟，比分工表的 5-8 分钟更长，以课程要求为准。

## 交付对照

| 分工要求 | 交付 |
| --- | --- |
| React 应用与四个核心视图 | `frontend/src/pages/`：时间线、根因、影响、耗时 |
| 订单号与问题事件选择、跳转 | 每页搜索框 + 事件卡按钮 + 图表/订单互链；选择写入 URL |
| 打开系统即定位最新异常 | 首页 `Latest exceptions` 汇总六个种子订单最新的 6 条 WARNING/FAILED，hero 链接与表格均可直接进入根因/影响；api 无全局事件列表接口，范围限定在种子演示订单 |
| 从异常事件到根因再到受影响订单 | 首页场景入口 + 根因页 “View impact of event #3” + 影响页订单链接 |
| Recharts 呈现平均 / P90 耗时 | `frontend/src/components/DurationChart.tsx`，八阶段双系列条形图 |
| 加载 / 空 / 接口失败 / 深链 | `useApi` + `Loading` / `EmptyState` / `ErrorState`；所有状态可从 URL 复现 |
| 演示种子入口 | 首页 `Demo scenarios` 表 + `Demo data loaded` 自检（校验订单可访问且基准事件存在）；实际数据导入由成员 2/5 执行 |
| 文字溢出、窄屏、1920×1080 | 1920 下四视图截图；1280 / 768 / 512 / 375 窄屏截图；影响图横向滚动可键盘聚焦 |
| 关键截图 | [screenshots/](screenshots/) |
| 视频分镜 | [VIDEO_STORYBOARD.md](VIDEO_STORYBOARD.md) |

## 视觉方向

Precision Dark：中性石墨表面、发丝边框、单一蓝色强调色；Normal 用绿色、Warning 用琥珀、Failed 用红，蓝色只做交互强调；靠明度层级而非阴影建立深度；Inter Variable + JetBrains Mono；6/8px 圆角。参考 Linear Dark 的克制、Deep Teal Console 的明度层级与 Swiss 网格纪律。

## 验收结果

- 搜索框对空值/非法事件 ID 给出 inline 提示；路由内渲染错误由 `ErrorBoundary` 兜底，页头和导航保持可用。
- 首页场景表带有 demo readiness 检查：真实 API 可达且 `SO-SYN-000001` 含配置的基准事件时显示 `Demo data loaded`，否则提示先启动 API 并导入 benchmark_data。
- 四个视图均从真实 FastAPI + PostgreSQL（seed 5003，57 条基准数据）取数；响应字段与契约一致，未在前端猜测字段名称。
- 三个基准场景均已在界面截图确认：`#3→订单 1/2`、`#23→订单 3/4`、`#46→订单 5/6`；时间线、根因链、影响订单数与最早异常均与后端响应一致。
- HTTP 错误：404（不存在的订单）、422（非法参数 / 时间区间）、503 / 504（数据库不可用 / 超时）均有统一错误页；404/422 来自真实请求，503/504 通过受控响应拦截验证同一错误页并截图。
- 1920×1080 下影响图 8 列、15 节点完整显示，无节点或文字截断；耗时图 8 个阶段名称完整换行。
- 首页最新异常按 `event_time` 降序、同一时间按事件 ID 降序排列；当前最新为 `#57`（2026-01-03 15:22 UTC，`SO-SYN-000006`）。搜索框默认留空，不再预填第一条订单。
- 右侧预览固定在 `SO-SYN-000001` 的供应商延期场景，标题标注 `Demo preview · Supplier delay`，避免被误读为最新异常详情；`#57` 的根因链以自身为最早异常、影响仅 1 个订单，不适合作为首屏演示。
- 订单时间线改为最新事件在上、最早事件在下（顶部事件带 `Latest` 标签，列表上方标注 `Newest first`），与快递轨迹一致；根因链保持最早原因在上、选中事件在下，并标注 `Causal order, not recency`，不受影响。
- 窄屏下最新异常表切换为三行卡片式布局，订单号、时间与状态不再折行；375 宽度下导航五项完整显示，首页标题与预览不截断。
- 窄屏卡片为每个单元格保留隐藏列名（Event / Order / Status / Time / Open），读屏仍能识别字段；首页预览、demo readiness 与最新异常面板共用同一次时间线请求（六个订单共六次请求）。
- 已在 100,000 事件库（seed 5003，10,989 订单）复测四个视图：三个基准场景的订单时间线、根因链和影响订单与 57 事件库完全一致；耗时页显示 10,989 个样本；随机订单和随机事件可深链；1280/375 无溢出或控制台错误。
- 影响图在每条订单 lane 的起始卡片上方标注订单号，并按自上而下的顺序在说明中列出，避免把并行的订单链误读为重复事件。
- 顶栏 `Display` 菜单提供 `Color vision` 四档（Standard / Red-green safe / Blue-yellow safe / Monochrome）、高对比度和减少动效，偏好保存在本地；菜单内 `Status markers` 图例用颜色和文字标出各状态，Monochrome 下整页转灰度，同一图例显示圆/方/菱形/空心标记；状态徽章和圆点始终带图标与文字，不依赖单一颜色。
- 从受影响订单进入导航时，Root cause / Impact 指向该场景的根因事件（例如订单 2 指向 `#3`，不再指向订单 1 的 `#10`）；根因页 Event context 显示订单号而非只有内部 `#id`。
- 最新异常表补充客户与承诺日期（订单号/时间下方副行），耗时页主指标改为 `Slowest P90`，平均值保留在副文案和图表中；P90 柱使用斜纹填充，Average 保持实心，不依赖颜色区分两个系列。
- 导航以 sessionStorage 记住最近一组有效上下文（订单、事件及其所属订单）；从事件页回到 Overview 后，Timeline / Root cause / Impact 不再跳回 demo 默认值，事件导航链接也继续带 `?order=`。从事件进入订单时间线后，该订单的 Root cause / Impact 保持刚看过的事件；直接打开订单时由时间线发布该订单最新异常作为锚点，不会落到另一个订单的场景根事件。
- 导航逻辑不绑定具体订单号/事件号：订单页来自时间线响应，事件页来自 URL；demo 订单列表、场景映射和默认值集中在 `demo.ts`。接入真实订单时把服务端订单列表传给 `useRecentExceptions(orderNumbers)` 并替换演示默认值即可。根因响应只有 `order_id`，所以不带 `?order=` 的真实事件深链会用 `impact?max_depth=0` 反查源事件订单号（只查该事件，约 0.2s），成功后写回 URL 并缓存；查不到时回退 `#order_id`。后端若在根因响应补 `order_number`，可以省掉这次反查。
- `npm run typecheck`、`npm run build`、`npm test` 通过（9 个测试文件、53 项测试）；路由级代码分割后主包 296.2 kB（gzip 93.2 kB），耗时页 378.6 kB（gzip 109.1 kB，含 Recharts）。
- 数据 GET 请求对网络错误和 502/503/504 自动重试一次（约 300 ms 后）；懒加载 chunk 失效时 `ErrorBoundary` 自动刷新一次，减少偶发错误页需要手动刷新的情况。

## 三个基准场景的界面证据

| 场景 | 时间线 | 根因追溯 | 影响传导 |
| --- | --- | --- | --- |
| 供应商延期 `#3` | [timeline-1920](screenshots/timeline-1920.png) | [rootcause-1920](screenshots/rootcause-1920.png) | [impact-1920](screenshots/impact-1920.png) |
| 质检失败 `#23` | [timeline-quality-1920](screenshots/timeline-quality-1920.png) | [rootcause-quality-1920](screenshots/rootcause-quality-1920.png) | [impact-quality-1920](screenshots/impact-quality-1920.png) |
| 运输中断 `#46` | [timeline-transport-1920](screenshots/timeline-transport-1920.png) | [rootcause-transport-1920](screenshots/rootcause-transport-1920.png) | [impact-transport-1920](screenshots/impact-transport-1920.png) |

## 截图

### 1920×1080

![总览](screenshots/home-1920.png)

![订单时间线](screenshots/timeline-1920.png)

![根因追溯](screenshots/rootcause-1920.png)

![影响传导](screenshots/impact-1920.png)

![环节耗时](screenshots/durations-1920.png)

### 窄屏与错误状态

![影响传导 1280](screenshots/impact-1280.png)

![订单时间线 768](screenshots/timeline-768.png)

![环节耗时 768](screenshots/durations-768.png)

![总览 512](screenshots/home-512.png)

![总览 375](screenshots/home-375.png)

![最新异常 512](screenshots/home-512-recent.png)

![订单时间线 512](screenshots/timeline-512.png)

![环节耗时 512](screenshots/durations-512.png)

![404 错误](screenshots/notfound-1280.png)

![422 参数错误](screenshots/durations-422.png)

![503 数据库不可用](screenshots/impact-503.png)

![504 查询超时](screenshots/impact-504.png)

![Display 菜单](screenshots/display-menu-1280.png)

![红绿色盲友好模式](screenshots/colorblind-timeline-1920.png)

![蓝黄色盲友好模式](screenshots/blue-yellow-timeline-1920.png)

![单色模式](screenshots/monochrome-timeline-1920.png)

![空数据状态](screenshots/durations-empty.png)

![30 秒健康轮询后仍显示 API live](screenshots/health-after-poll.png)

## 交接给成员 5

- 源码：`task4_frontend` 合并后，把 GitHub 仓库链接写入报告第 9 节。
- 报告：Technical Design 引用前端架构、路由和 API 对接层；Evaluation 引用四视图截图、1920/窄屏检查与 demo readiness；文件按课程要求命名 `XXXX-report.pdf`。
- 视频：课程要求 8-10 分钟（分工表写 5-8 分钟，以课程为准），前端片段约 3-4 分钟；报告第 9 节附可访问链接。
- README：`frontend/README.md` 已包含结构、依赖和运行命令；根 README 已加 Part 4 入口。

## 复现命令

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173，代理到 127.0.0.1:8001
npm run typecheck
npm run build
```

后端未启动时可用 `VITE_USE_MOCK=true` 检查供应商延期场景；界面右上角会显示 `Mock data`。
