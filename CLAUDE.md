# CLAUDE.md

本文档为 AI Coding Agent 在本项目中工作提供指导。

## 项目概述

这是一个基于 **Hugo**（去主题化，采用自研 **Warm Amber / 暖金测绘** 原生模板与样式系统）构建的静态技术博客，通过 GitHub Actions 在推送到 `main` 分支时自动部署到 **GitHub Pages**（根域名 `https://zero-kq.github.io/`）。

## 语言偏好

与用户交流时使用**中文**。

## 命令

### 开发与构建

```bash
# 本地预览（含文件监听、自动重构建与 Shiki 后处理）
npm run dev

# 生产构建（Hugo + Shiki dark-plus 后处理，输出到 public/）
npm run build

# 指定根域名构建验证
npm run build -- --baseURL "https://zero-kq.github.io/"
```

### GitHub Actions 部署
站点会在推送到 `main` 分支时自动部署（`.github/workflows/gh-pages.yml`）。
默认使用 Hugo Extended 版本 `0.166.0` 与 Node.js `22`。

## 文档任务规则
- 生成、更改和完善文档前必须先读取 `demo.md`，按 `demo.md` 要求进行
- 不允许跳过此步骤直接参考已有文档的格式
- 在修改文档时，不能篡改已有的文字和代码内容，只对格式和布局进行优化

## 架构

### 目录结构

- `hugo.toml` - Hugo 主配置（`locale = 'zh-CN'`，无外部主题，配置 5 项主菜单与 Goldmark math passthrough）
- `content/` - Markdown 内容文件
  - `posts/` - 技术博客文章
  - `projects/` - 学习系列 / 开源项目卡片数据（每个项目一个 `.md`）
  - `archive/_index.md` - 时间轴页入口
  - `about/index.md` - 关于页正文
- `layouts/` - 全站原生 Hugo 模板
  - `_default/baseof.html` - 统一页面骨架（防闪烁主题脚本 + 页头 + 页脚 + JS）
  - `_default/single.html` - 文章详情页（阅读进度条、面包屑、吸顶 TOC、上下篇导航）
  - `_default/list.html` - 通用列表/分类回退模板
  - `_default/_markup/render-codeblock.html` - Mermaid 包裹与高亮输出钩子
  - `_default/_markup/render-image.html` - 站内图片 `relURL` 路径适配
  - `index.html` - 暖金首页（Plan P Logo、LiDAR SVG、LIVE INDEX 动态统计、最近文章、方向索引）
  - `posts/list.html` - 博客列表页（即时搜索框 + 动态分类筛选 Chip）
  - `projects/list.html` - 学习系列 / 项目展示页
  - `archive/list.html` - 按年份倒序分组时间轴页
  - `about/single.html` - 两栏编辑风关于页
  - `partials/{head,header,footer,post-card}.html` - 公共组件
- `assets/` - Hugo Pipes 构建资源
  - `css/site.css` - 暖金暗/亮双主题 Design Token、全站响应式样式、KaTeX/Mermaid/Shiki 排版
  - `js/site.js` - 主题切换、移动端导航、`/` 快捷检索、博客即时筛选、代码复制与 TOC 滚动高亮
- `static/images/mark.svg` - Plan P 双端入雾孤线 SVG Favicon
- `scripts/` - `build.mjs`、`preview.mjs`、`shiki-highlight.mjs`（Shiki `dark-plus` 构建后处理）

### 路径与渲染管线注意点

1. **GitHub Pages 根路径与 `baseURL` 适配**：
   - 站点部署在根域名 `https://zero-kq.github.io/`，但所有站内链接与资源路径仍通过 `relURL`、`.RelPermalink` 或菜单 `.URL` 生成；不要对已经解析过 `baseURL` 的菜单 `.URL` 再次调用 `relURL`（避免在带子路径 `baseURL` 下重复前缀）。
   - Markdown 图片若以 `/` 开头（如 `/posts/slam/...`），由 `layouts/_default/_markup/render-image.html` 转为 `relURL`。
2. **Shiki 代码高亮**：
   - `render-codeblock.html` 将非 `mermaid` 代码块交给 `transform.Highlight`，保留 `.highlight code[data-lang]` 结构；
   - `scripts/shiki-highlight.mjs` 在构建后统一替换为 Shiki 双主题（`dark-plus` + `github-light`）高亮 HTML；
   - CSS 中 `.highlight` 随 `data-theme="dark" / "light"` 自动切换 `--code-bg` 与 `--shiki-light` 语法配色。
3. **KaTeX 与 Mermaid**：
   - 在 `layouts/partials/head.html` 中按需引入（`math = true` 时加载 KaTeX；正文含 `class="mermaid"` 时加载 Mermaid v10 并随 `data-theme` 自动切换明暗主题）。
4. **Hugo 清理构建**：
   - 修改 CSS 或模板后如需彻底清理缓存：
     `rm -rf public resources && npm run build`
