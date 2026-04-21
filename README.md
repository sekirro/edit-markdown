# Markdown Notebook

[English](./README.en.md) | 简体中文

一个本地优先的 Markdown 笔记项目，提供文件树管理、编辑预览分屏、全文搜索、代码高亮和自动保存能力。前端基于 `React + Vite`，后端基于 `Express`，笔记内容默认保存在仓库内的 `notes/` 目录。

## 功能特性

- Markdown 实时预览，支持 GitHub Flavored Markdown
- 代码块语法高亮
- 编辑 / 预览 / 分屏三种视图切换
- 文件树浏览、重命名、删除
- 根目录与子目录下新建笔记 / 文件夹
- 全文搜索笔记内容
- 自动保存与手动保存
- 字数、字符数、行数统计

## 技术栈

- Frontend: `React 19`, `TypeScript`, `Vite`
- Backend: `Express 5`
- Markdown: `react-markdown`, `remark-gfm`, `rehype-highlight`

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式启动

先启动后端：

```bash
npm run server
```

后端默认运行在 `http://localhost:3001`。

再在另一个终端启动前端开发服务：

```bash
npm run dev
```

前端开发地址为 `http://127.0.0.1:5173`，并通过 Vite 代理访问 `/api`。

开发时请优先访问：

```text
http://127.0.0.1:5173
```

### 3. 构建后运行

```bash
npm run build
npm start
```

构建完成后，`server.js` 会自动托管 `dist/` 下的前端资源。

构建后访问：

```text
http://localhost:3001
```

## 项目结构

```text
.
├── notes/                  # 本地笔记目录
├── src/
│   ├── components/         # Sidebar / Editor / Preview / Search
│   ├── App.tsx             # 应用主逻辑
│   └── index.css           # 界面样式
├── server.js               # 本地文件读写 API 与静态资源服务
├── vite.config.ts          # Vite 配置与开发代理
└── package.json
```

## 使用说明

### 当前使用流程

开发时推荐按下面顺序使用：

1. 运行 `npm install`
2. 终端 A 运行 `npm run server`
3. 终端 B 运行 `npm run dev`
4. 浏览器打开 `http://127.0.0.1:5173`
5. 在网页中编辑笔记，文件会保存到 `notes/` 目录

### 地址说明

- `http://127.0.0.1:5173`：前端开发环境，支持热更新，日常开发应优先使用这个地址
- `http://localhost:3001`：本地后端服务地址，负责文件读写 API；如果仓库里已经有 `dist/`，它也会顺带托管构建后的前端页面
- 如果你改了 `src/` 代码但没有重新执行 `npm run build`，`3001` 打开的页面可能还是旧的构建结果
- 所以开发源码时用 `5173`，查看构建后的正式效果时用 `3001`

### 笔记与文件夹

- 点击侧栏顶部 `➕` 可以在根目录新建笔记
- 点击侧栏顶部 `📁` 可以在根目录新建文件夹
- 将鼠标移到某个文件夹上，可以在该目录下继续新建笔记或子文件夹
- 点击文件可打开编辑；点击文件夹可展开或收起
- 支持重命名和删除文件 / 文件夹

### 创建操作说明

- 新建文件或文件夹时，输入名称后需要按 `Enter` 才会真正创建成功
- 仅输入名称但没有按 `Enter` 时，不会提交创建
- 新建笔记时，如果没有手动输入扩展名，系统会自动补全为 `.md`

### 编辑与预览

- `Tab`：插入两个空格缩进
- `Shift + Tab`：取消当前行前的两个空格缩进
- 可在编辑、预览、分屏三种模式之间切换
- 默认开启自动保存；也可以使用手动保存按钮或快捷键保存

### 搜索

- 使用 `Ctrl/Cmd + F` 打开全文搜索
- 搜索会扫描 `notes/` 下的 `.md`、`.markdown`、`.txt` 文件

## 快捷键

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + S` | 保存当前文件 |
| `Ctrl/Cmd + F` | 打开或关闭搜索 |
| `Tab` | 缩进 |
| `Shift + Tab` | 取消缩进 |
| `Esc` | 关闭搜索或取消当前输入 |

## 数据说明

- 所有笔记文件默认存放在 `notes/` 目录
- 后端接口会直接对本地文件系统执行读写操作
- 前端当前主要面向 Markdown / 文本文件使用
- 迁移到另一台电脑时，建议复制整个项目目录后重新执行一次 `npm install`

## License

本项目基于 `MIT License` 开源，详见 [LICENSE](./LICENSE)。
