# lucky-hub

一个个人使用的**福彩双色球**开奖数据站：展示最新开奖、查看最近 30 期、生成号码并收藏守号。

纯静态、零后端——开奖数据在构建前就存成 JSON，页面打开即用，所有统计与选号都在浏览器本地完成。

**在线访问：<https://everwynn.github.io/lucky-hub/>**

> 当前数据：第 **2026124** 期（2026-10-29），共 **2082** 期，覆盖 2013001 → 2026124。
>
> **更新方式**：福彩官网对 GitHub 的海外 IP 返回 `HTTP 403`，云端抓取不可用。
> 数据在本地抓取（`npm run dev` 的「立即抓取」按钮）后提交推送，由 Actions 自动构建发布，
> 详见「[数据更新](#数据更新重要)」。

---

## 功能

| 页面 | 内容 |
|---|---|
| 首页 `/` | 最新一期大号彩球、最近 30 期表格、数据截止期号与更新时间；抓取失败时顶部显示黄色提示条 |
| 生成号码 `/generate` | 两种模式选号、三档统计窗口、守号收藏、一键复制 |
| 关于 `/about` | 数据来源、更新机制、最近一次抓取状态、免责声明；`npm run dev` 下额外显示「立即抓取」按钮 |

其他细节：

- **浅色 / 深色 / 跟随系统** 三档主题，切换时从按钮中心做圆形扩散动画；用户要求减少动效或浏览器不支持时自动降级为瞬时切换
- 号码球带 `aria-label`（如「红球 03」），触控区不小于 36px
- 全站 `noindex`，`robots.txt` 返回 `Disallow: /`，不生成 sitemap
- 守号保存在浏览器 `localStorage`（键 `lucky-hub:favorites`），上限 10 注

---

## 选号逻辑

两种模式，切换时第二行控件会跟着显示/隐藏：

**纯随机**：1–33 等概率不放回抽 6 个红球 + 1–16 抽 1 个蓝球，每注概率完全相同。

**加权**：统计窗口内出现次数越多的号码权重越大，权重 = `出现次数 + 1`（`+1` 保证冷号也有机会）。

| 窗口 | 最热 : 最冷 权重比 | 性格 |
|---|---|---|
| 近 30 期 | ≈ 4.3 : 1 | 灵敏，但追的大多是噪声 |
| 近 100 期（默认） | ≈ 2.5 : 1 | 平衡，排名更稳 |
| 全部历史 | ≈ 1.3 : 1 | 几乎等于纯随机，用来对照 |

页面会把当前档位的实际权重比直接显示出来，并固定声明：

> 彩票每期独立随机，历史数据不改变任何号码的中奖概率。加权只是让结果偏向近期热门号，**中奖率与纯随机完全相同**。

---

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 站点框架 | Astro 4.16（`output: 'static'`） | 全站预渲染，无 SSR |
| 交互 | Vue 3.5 | 只有生成页一个 island（`client:load`） |
| 样式 | Tailwind CSS 3.4 | `darkMode: 'class'` + CSS 变量语义色 |
| 语言 | TypeScript 5.6 | `astro/tsconfigs/strict` |
| 运行时 | Node ≥ 20.6 | 脚本全部是 `.mjs`，无构建步骤 |
| 测试 | `node:test` + `tsx` | 不引 Vitest / ESLint / 图表库 / 数据库 |

---

## 架构

```
本地（作者机器）
  ├─ npm run dev → /about 页「立即抓取」
  │    └─ POST /api/local/fetch → astro:server:setup 中间件（仅 dev 注册）
  │         ├─ scripts/fetch.mjs：抓取 → 合并去重 → 校验 → 写 data/*.json
  │         └─ sync-data：data/ → public/data/
  └─ git commit + push
        ↓
GitHub Actions（push 到 main 即触发，或手动 workflow_dispatch）
  ├─ npm ci → npm test → npm run test:lib
  ├─ npm run build        ← CI=true → base=/lucky-hub/
  └─ upload-pages-artifact → deploy-pages
        ↓
  https://everwynn.github.io/lucky-hub/
        ↓  浏览器 fetch
  /data/draws.json → 本地统计 → 渲染 / 生成号码
```

数据流向（本地 Node 抓、浏览器只读，不能反过来）：

```
福彩官网接口
  ↓ scripts/fetch.mjs（超时 15s、重试 3 次、指数退避）
data/draws.json            ← 唯一数据源，提交进仓库
  ↓ npm run dev / build 时 sync-data 复制
public/data/draws.json     ← 生成物，已 gitignore
  ↓ Astro 原样输出
dist/data/draws.json
  ↓ deploy-pages
https://…/lucky-hub/data/draws.json
  ↓ 浏览器 fetch
页面展示 / 选号
```

> 为什么必须由 Node 抓：官网接口不返回 `Access-Control-Allow-Origin`，浏览器直连会被 CORS 拦截；
> 所以本地抓取也只能先到 dev server 的中间件，再由 Node 去请求官网。

职责边界：

| 模块 | 只负责 | 不做 |
|---|---|---|
| `scripts/fetch.mjs` | 取数、归一化、合并、校验、写盘 | 不做任何统计计算 |
| `src/lib/generate.ts` | 纯函数选号算法 | 不读文件、不碰 DOM |
| `src/lib/data.ts` | 构建期读 `data/*.json` | 不做计算 |
| `src/components/` | 展示与交互 | 不含算法逻辑 |

---

## 目录结构

```
lucky-hub/
├─ .github/workflows/deploy.yml   构建 + 部署（唯一 workflow）
├─ data/
│  ├─ draws.json                  全量开奖记录（按期号升序）
│  ├─ meta.json                   最新期号 / 日期 / 总数 / 更新时间
│  └─ health.json                 最近一次抓取状态（/about 展示）
├─ scripts/
│  ├─ fetch.mjs                   增量抓取编排
│  ├─ backfill.mjs                全量回填
│  ├─ normalize.mjs               官网响应 → Draw，按期号合并去重
│  ├─ validate.mjs                数据校验规则
│  ├─ sync-data.mjs               data/ → public/data/
│  └─ lib/{http,pages}.mjs        带重试的 HTTP 封装 / 翻页收集器
├─ src/
│  ├─ components/{Generator.vue,ThemeToggle.astro,LocalFetchPanel.astro}
│  │                              Generator 是唯一 island；LocalFetchPanel 仅 dev 渲染
│  ├─ layouts/BaseLayout.astro
│  ├─ lib/{data,format,generate,loadDraws}.ts
│  ├─ pages/{index,generate,about,404}.astro、robots.txt.ts
│  └─ styles/global.css
├─ tests/
│  ├─ scripts/*.test.mjs          数据管道测试
│  └─ lib/*.test.ts               格式化与选号测试
└─ astro.config.mjs（含 dev-only 抓取接口）/ tailwind.config.mjs / tsconfig.json
```

---

## 本地运行

需要 Node ≥ 20.6。

```bash
npm ci          # 安装依赖（.npmrc 里的 legacy-peer-deps=true 是必需的）
npm run dev     # http://localhost:4321
```

`dev` 与 `build` 都会先执行 `sync-data`，把 `data/*.json` 复制到 `public/data/`，不需要手动同步。

```bash
npm run build     # 产物在 dist/
npm run preview   # 预览构建结果（需先 build，占用同一个 4321 端口）
npm test          # 数据管道测试（17 例）
npm run test:lib  # 格式化 + 选号测试（9 例）
```

> Windows PowerShell 5.1 不支持 `&&`，请用分号 `;` 或分行执行。
> 脚本内部的 `&&` 由 npm 通过 `cmd.exe` 执行，不受影响。

---

## 数据更新（重要）

### 为什么抓取放在本地

福彩官网 `www.cwl.gov.cn` 对 GitHub Actions 的海外 IP 返回 **`HTTP 403 Forbidden`**（4 次重试全部失败）。
云端定时任务只会每天多一条失败记录，因此 workflow 里的定时抓取已经移除，抓取改在本机执行。

### 方式一：页面按钮（推荐）

```bash
npm run dev
```

打开 <http://localhost:4321/about>，底部「本地抓取（仅开发环境）」面板点**立即抓取**：

- 按钮只在 `npm run dev` 下出现，`npm run build` 的产物里一行都不会有（`import.meta.env.DEV` 在构建期被裁掉）
- 接口是 `astro.config.mjs` 用 `astro:server:setup` 注册的 dev-only 中间件 `POST /api/local/fetch`，`astro build` 从不注册它
- 抓完自动 `sync-data` 并刷新页面，立刻能看到新数据；失败会直接显示错误原因（如 `HTTP 403 Forbidden`）
- 只接受本机 IP 调用，即使 `astro dev --host` 暴露到局域网也不会被外部触发

### 方式二：命令行

```bash
npm run fetch        # 增量：抓第 1 页 → 合并去重 → 校验 → 写盘（无新增则一个字节都不写）
git add data
git commit -m "chore(data): refresh"
git push
```

推送到 `main` 会**自动触发** Actions 构建部署，不需要再去网页点 Run。

全量重建（数据损坏或首次搭建时）：

```bash
npm run backfill     # 翻 120 页，约 1 分钟
```

### 数据安全规则

- 校验不通过 → **整轮放弃写入**，旧文件完好（期号格式、红球 6 个不重复 1–33、蓝球 1–16、期号严格递增）
- 无新增期号 → 一个字节都不写，避免产生无意义的 git 提交
- 第 1 页最旧期号仍比本地最新期号新 → 判定为断层，自动翻页补齐
- 重复抓取安全：`mergeDraws` 以**期号**为键做 `Map` 去重，同一期号**远端覆盖本地**；
  `added = 合并后长度 - 原有长度`，为 0 时直接跳过写盘

---

## 部署

`.github/workflows/deploy.yml` 是唯一 workflow，只做「安装 → 测试 → 构建 → 发布」，不再抓取：

```yaml
on:
  push:
    branches: [main]      # 本地提交后自动上线
  workflow_dispatch:      # 网页手动重跑
```

权限只需要三项。其中 `contents: read` 不能省——一旦声明 `permissions`，未列出的权限会变成 `none`，缺了它 `checkout` 直接失败：

```yaml
permissions:
  contents: read
  pages: write      # deploy-pages 发布产物
  id-token: write   # deploy-pages 走 OIDC 认证
```

仓库需要在 GitHub 网页上设置一次：

- **Settings → Pages → Source = GitHub Actions**

> 早期版本由 Actions 抓取并提交数据，那时还需要把 Workflow permissions 设为 `Read and write`；
> 现在 Actions 只读仓库，这一项**不再需要**。

`astro.config.mjs` 中 `base` 在 CI 下固定为 `/lucky-hub/`，所以**仓库名必须是 `lucky-hub`**，否则静态资源全部 404。

---

## 测试

| 文件 | 覆盖 |
|---|---|
| `tests/scripts/normalize.test.mjs` | 官网页字段清洗、按期号合并去重与排序 |
| `tests/scripts/validate.test.mjs` | 期号 / 日期 / 红球 / 蓝球 / 递增与重复的拦截规则 |
| `tests/scripts/pages.test.mjs` | 翻页收集的停止条件与页数上限 |
| `tests/scripts/fetch.test.mjs` | URL 构造、错误原因拼接、health 状态写入与去重 |
| `tests/lib/data.test.ts` | 号码格式化、UTC → 北京时间 |
| `tests/lib/generate.test.ts` | 生成结果合法性、可复现、窗口统计、加权有效性 |

---

## 已知限制

- **没有云端自动抓取**：官网对 GitHub 的海外 IP 返回 403，数据只能本地更新；抓取接口只存在于 `npm run dev`，`preview` 与线上都没有
- **noindex 不等于访问控制**：搜索引擎不会收录，但拿到链接的人仍可访问。若要真鉴权，需挂自定义域名 + Cloudflare Access，与应用代码无关
- **Node 20 已过维护期**：workflow 里 `node-version: 20` 仍可运行，后续建议升到 22 LTS
- 设计与实施记录保存在本地 `docs/`，未纳入版本库（已在 `.gitignore` 中）

---

## 免责声明

- 数据来源为中国福利彩票官网公开开奖接口，每日低频访问，不镜像站点、不存储正文
- 本站仅供个人娱乐与技术练习，**不构成任何投注建议**，不承诺任何中奖概率
- 请理性购彩，未成年人不得购买彩票
