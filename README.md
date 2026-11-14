# Echo-Frontend · Yeve Echo 前端 v1

> 社交是向外的喧嚣，Echo 是向内的回响。

Yeve Echo 是一款以「反转社交范式」为核心的情绪表达 Web 应用：它剥离公开的点赞数、评论列表与好友动态，让表达回到「人与内容」本身。本仓库是它的**第一代前端（v1）**，基于 Vue 3 + Vite + TypeScript 实现，覆盖漂流瓶（浮笺）、纸飞机（飞笺）与 Soul Echo（Agent to Agent）三条主链路，并包含一条智能戒指语音输入的硬件链路。

- 在线演示：<https://echo.yeve.top>（当前由 [Echo-Frontend-v2](https://github.com/aYYbsYYa/Echo-Frontend-v2) 提供）
- 服务端：<https://github.com/aYYbsYYa/Echo-Backtend>
- 第二代前端：<https://github.com/aYYbsYYa/Echo-Frontend-v2>

---

## 一、项目介绍

### 1.1 要解决的问题

传统社交平台把表达异化为对曝光度的追逐：发布前先想「别人会怎么看」，发布后反复刷新点赞与评论。声音被听见了，却未必被听懂。Yeve Echo 的做法是**把社交反馈从公共空间撤走**——内容仍然会被陌生人偶然读到，但点赞与评论只对发布者本人可见，不产生任何公开的计分板。

### 1.2 功能矩阵（v1 命名 → 产品命名）

| 页面 | 路由 | 产品功能 | 说明 |
| :--- | :--- | :--- | :--- |
| HomeView | `/` | 浮笺 / 飞笺 | 海面主场景：发布内容、完全随机捞取陌生人的笺纸、智能戒指语音录入面板 |
| OnboardingView | `/start` | 匿名初始化 | 填写昵称、出生日期、性别，浏览器生成本地匿名 ID |
| HistoryView | `/history` | 我的档案 | 汇总本人发布过的漂流瓶与纸飞机及其私有互动 |
| BottleDetailView | `/bottle/:id` | 浮笺详情 | 单张笺纸的完整阅读、点赞、留言入口 |
| PlaneDetailView | `/plane/:id` | 飞笺详情 | 同上，额外渲染 `scene` 场景文案 |
| SoulEchoView | `/soul` | 灵笺 / Agent to Agent | 灵魂画像 → 灵魂匹配 → 双 Agent 对话 → 回响分析 → 历史回响 |

> v1 代码沿用「漂流瓶 / 纸飞机 / Soul Echo」的工程命名，术语统一为「浮笺 / 飞笺 / 灵笺」发生在 v2 的重构提交中。

### 1.3 使用方式

1. 首次进入会被路由守卫重定向到 `/start`，填写昵称、出生日期与性别；匿名 ID 由浏览器生成并写入 `localStorage`（键名 `echo.user`），此后每个请求都携带它，全程无需手机号、邮箱或密码。
2. 在 `/` 写下一段文字（可配图）投入海中或折成飞机掷出；也可以随时「随机捞取」一张陌生人的笺纸。
3. 别人给你的点赞与留言只出现在你自己的视角里，他人无法看到你的任何互动数据。
4. 进入 `/soul`，系统基于你的表达生成灵魂画像，与候选 Agent 匹配，让两个 Agent 匿名对话，最后给出一份只属于你的共鸣分析。

---

## 二、技术架构

### 2.1 技术栈

| 层次 | 选型 | 版本 | 说明 |
| :--- | :--- | :--- | :--- |
| 框架 | Vue 3 | `^3.5.40` | Composition API + `<script setup>` |
| 语言 | TypeScript | `~6.0.0` | 类型检查由 `vue-tsc --build` 承担 |
| 构建 | Vite | `^8.1.5` | `@vitejs/plugin-vue`、`plugin-vue-jsx`、`vite-plugin-vue-devtools` |
| 路由 | Vue Router | `^5.2.0` | History 模式 |
| 状态 | Pinia | `^4.0.2` | 已声明依赖；业务状态实际由各视图直接持有（见 2.5 已知限制） |
| 样式 | 手写 CSS | — | 单一 `src/assets/main.css`（333 行），CSS 变量 + `@keyframes`，无 UI 组件库、无 Tailwind |
| 请求 | 原生 `fetch` | — | 无 axios，统一封装在 `src/api/echo.ts`（188 行） |
| 动画 | Vue `<Transition>` | — | 无动画库 |
| 硬件 | Web Bluetooth API | — | 智能戒指录音与投掷手势，见 2.4 |

运行环境要求见 `package.json` 的 `engines` 字段：Node `^22.18.0 || >=24.12.0`。

### 2.2 目录结构

```
src/
├─ api/echo.ts          # 唯一 API 出口：请求封装、NDJSON 流解析、媒体 URL 归一
├─ assets/main.css      # 全站设计令牌与动画关键帧
├─ components/          # 5 个组件（发布面板、发现卡片、戒指面板等）
├─ router/index.ts      # 6 条路由 + 匿名身份守卫
├─ services/ringSound.ts# Web Bluetooth 戒指协议栈
├─ stores/              # Pinia 目录（脚手架遗留）
├─ utils/               # 通用工具
├─ views/               # 6 个路由级视图
├─ types.ts             # 与后端契约对齐的类型定义
├─ App.vue
└─ main.ts
```

分层约定：**视图按路由切分并直接调用 `@/api/echo`**，不经过中间 store 层；类型集中在 `types.ts`，与后端 JSON 字段一一对应。

### 2.3 数据流

```
视图 (views)
  └─ 组合式函数 / ref 状态
       └─ src/api/echo.ts  ── fetch ──►  Flask 后端 /api/*
            └─ resolveMediaUrl()  把后端返回的相对图片路径拼到 API origin
```

服务端地址完全来自 `import.meta.env.VITE_API_BASE_URL`（`src/api/echo.ts:10`），源码中不硬编码任何环境地址。

### 2.4 AI 与硬件链路的前端落点

| 能力 | 实现位置 | 机制 |
| :--- | :--- | :--- |
| Agent 对话流式渲染 | `src/api/echo.ts:49-103` | `POST /agent/dialogue/stream` + `response.body.getReader()` 逐行解析 **NDJSON**，事件类型 `start \| message \| echo \| done \| error`（非 EventSource / WebSocket） |
| AI 思考状态可视化 | `src/views/SoulEchoView.vue:36` | `dialoguePhase`（`idle / connecting / speaking / summarizing / saving / complete / error`）驱动状态文案，如「X 正在组织下一条表达…」 |
| 增量上屏与滚动 | `SoulEchoView.vue:147` | 每条消息到达即 push 并自动滚动到最新，尊重 `prefers-reduced-motion` |
| 中断与竞态防护 | `SoulEchoView.vue:279` | `AbortController` + 自增 `dialogueRequestId`，组件卸载时中止请求，丢弃过期响应 |
| 语音输入 | `src/services/ringSound.ts`、`RingSoundPanel.vue` | Web Bluetooth 连接智能戒指：自定义 11 字节包头 + magic `0x3f` + CRC16 分帧解析，音频分片按 offset 重组；IMU 加速度/陀螺仪识别「投掷」手势 |
| 语音转文字 | `POST /audio/transcriptions` | 戒指录音上传后端，SenseVoice 本地转写后回填发布框（`HomeView.vue:57` `voiceDraft`），可自动发送 |
| 错误兜底 | 各视图 | `errorMessage()` 将 fetch/network 异常转为中文提示；画像、匹配、对话三个区块各有独立的错误态与「重新读取 / 重新寻找 / 再碰撞一次」按钮 |

> Web Bluetooth 需要桌面版 Chrome 或 Edge，且必须在 `https` 或 `localhost` 下运行；戒指链路为可选体验，缺失时其余功能不受影响。

### 2.5 已知限制

- 无登录鉴权体系，匿名 ID 仅存于浏览器本地，清站数据即丢失身份。
- v1 未实现心笺（时间胶囊）与浏览器端录音，这两项在 v2 中补齐。
- `stores/counter.ts` 为脚手架遗留文件，全库无引用。
- 仓库不含自动化测试与 CI，质量保障依赖 `npm run type-check` 与人工验收。

---

## 三、安装与运行

### 3.1 前置条件

- Node.js `^22.18.0` 或 `>=24.12.0`
- npm（随 Node 分发）
- 一个正在运行的后端：<https://github.com/aYYbsYYa/Echo-Backtend>（默认监听 `http://localhost:3000`）

### 3.2 步骤

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量：复制模板后按需修改
cp .env.example .env        # Windows: copy .env.example .env

# 3. 启动开发服务器
npm run dev

# 4. 类型检查 / 生产构建 / 本地预览
npm run type-check
npm run build
npm run preview
```

### 3.3 可用脚本

| 命令 | 实际执行 | 用途 |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | 开发服务器，HMR |
| `npm run build` | `run-p type-check "build-only {@}" --` | 先类型检查再构建，任一失败即中断 |
| `npm run build-only` | `vite build` | 跳过类型检查直接构建 |
| `npm run type-check` | `vue-tsc --build` | 全量类型检查 |
| `npm run preview` | `vite preview` | 预览 `dist/` |
| `npm run format` | `prettier --write --experimental-cli src/` | 代码格式化 |

### 3.4 环境变量

`.env` 已被 `.gitignore` 忽略，仓库只提供 `.env.example` 模板；本仓库不含任何密钥。

| 变量 | 示例值 | 说明 |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | 后端 API 前缀，必须包含 `/api` |

### 3.5 部署要点

- 构建产物输出到 `dist/`（未提交进仓库）。
- 路由使用 History 模式，静态托管必须配置 SPA 回退（把 404 重写为 `index.html`）。
- `vite.config.ts` 未设置 `base`，资源以 `/assets/...` 绝对路径引用；如需 CDN 前缀请自行配置。

---

## 四、代码规范

| 项目 | 配置 |
| :--- | :--- |
| Prettier | `.prettierrc.json`：`semi: false`、`singleQuote: true`、`printWidth: 100` |
| EditorConfig | `.editorconfig`：UTF-8、LF、制表符缩进 |
| TypeScript | `tsconfig.app.json` 开启 `noUncheckedIndexedAccess`，`strict` 由 `@vue/tsconfig` 基线提供，`paths` 配置 `@/* -> ./src/*` |
| 推荐扩展 | `.vscode/extensions.json` 推荐 Volar + Prettier |

约定：组件与视图使用 `<script setup lang="ts">`；所有对外请求必须经由 `src/api/echo.ts`，禁止在视图内直接 `fetch`；与后端字段同名，不做重命名映射。

---

## 五、团队信息

**本次参赛队伍（传智杯）：Yeve Hoo**

| 成员 | 角色 | 分工 |
| :--- | :--- | :--- |
| 邓紫阳 | 队长 | 开发 |
| 刘艺红 | 队员 | 演示视频、PPT 与视觉物料 |

**原项目（黑客松版本）贡献者**

| 贡献者 | 分工 |
| :--- | :--- |
| aYYbsYYa（邓紫阳） | 前后端开发 |
| Speculator | 前后端开发 |
| Naije | 设计 |
| 是晞宝呀 | 设计 |

> 署名口径备注：**aYYbsYYa 即本次参赛队长邓紫阳本人**，本仓库 Git 提交作者记录为 handle，
> 上方「本次参赛队伍」表记录为真实姓名，两者指代同一人；其余三位贡献者暂未提供真实姓名，保持 handle 署名。

本仓库的 Git 提交记录（作者 `aYYbsYYa`、`Speculator`）保留了原项目的真实开发过程。

---

## 六、开发记录与仓库

- 原项目开发提交 15 次，时间跨度 2026-07-23 ~ 2026-07-24；2026-11 为本次赛项提交另加文档类提交。完整历史保留在 `main` 分支，未做压缩、改写或 rebase，可用 `git log --follow` 逐条核对。
- 主要演进：项目初始化 → 用户匿名初始化与环境变量 → 漂流瓶/纸飞机发布与发现 → 点赞与评论 → 图片上传与内嵌详情 → 戒指语音转文字 → Soul Echo API → Agent 对话实时流。
- 关联仓库：[Echo-Frontend-v2](https://github.com/aYYbsYYa/Echo-Frontend-v2)（第二代前端）、[Echo-Backtend](https://github.com/aYYbsYYa/Echo-Backtend)（服务端）。

## 七、许可与说明

本项目为参赛作品，代码公开用于评审与学习交流。项目中使用的第三方大模型 API 密钥、语音模型权重均不随仓库分发，需按各自官方条款自行获取与配置。
