# Yeve Echo Frontend

Yeve Echo 是一个匿名文字漂流社区。它不提供好友、关注或聊天关系，只让一段文字以漂流瓶或纸飞机的形式，偶然抵达愿意阅读的人。

## 技术栈

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia

## 安装

```bash
npm install
```

## 环境变量

复制 `.env.example` 为 `.env`：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

所有后端请求均从 `VITE_API_BASE_URL` 读取，代码中不包含服务端地址。

## 开发和构建

```bash
npm run dev
npm run build
```

首次打开时，用户填写昵称、出生日期与性别。浏览器生成匿名 ID 并写入 LocalStorage；此资料在 Demo 中不可编辑。之后可发布漂流瓶或纸飞机、完全随机捞取其他用户内容、查看自己的发布档案，以及进入 Soul Echo 页面体验 Agent-to-Agent 灵魂回响 Demo。
