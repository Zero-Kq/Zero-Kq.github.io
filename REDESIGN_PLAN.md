# Zero / Spatial Notes — 博客暖金重构总体修改方案

> **适用仓库**：`/home/yj/Z-person/Pages`（`https://github.com/Zero-Kq/Pages`）
> **线上地址**：`https://zero-kq.github.io/Pages/`
> **视觉原型参考**：仓库根目录下的 [`redesign-preview.html`](./redesign-preview.html)（已确认配色、导航结构、博客筛选交互与 **P 方案 Logo**）

---

## 一、总体架构决策

1. **保留现有仓库与内容渲染底座，不更换框架**：
   - 继续使用 **Hugo**（CI 使用 `0.166.0`），原样保留 `content/posts/` 下全部 Markdown 笔记。
   - 完整保留现有核心工程管线：
     - Goldmark 数学公式 passthrough + KaTeX 渲染；
     - `layouts/_default/_markup/render-codeblock.html` + `scripts/build.mjs` + `scripts/shiki-highlight.mjs`（Shiki `dark-plus` 构建后处理高亮）；
     - Mermaid 流程图渲染；
     - `.github/workflows/gh-pages.yml` 自动部署流程。
2. **去主题化（脱离 PaperMod）**：
   - 在新分支（如 `feat/warm-amber-redesign`）上实施，不影响 `main` 现有线上站点。
   - 移除 `hugo.toml` 中的 `theme = 'PaperMod'`，在根目录 `layouts/` 与 `assets/` 下编写一套精简、完全自主可控的原生模板与样式表（替代原先 PaperMod + 17KB `custom.css` 覆盖补丁）。
   - 验证构建和预览完全通过后再删除 `themes/PaperMod` 及旧的废弃覆盖模板（如 `sidebar-left.html`、`sidebar-right.html`、`terms.css` 等）。

---

## 二、已确认的视觉规范（Design System）

### 1. 品牌与左上角 Logo（已定稿：方案 P · 双端入雾孤线）

- **站点品牌名**：`ZERO` / 副标 `SPATIAL NOTES`
- **视觉理念**：保留立体立方体 Z 路径的空间折转骨架，去掉多余棱边并做 G1 连续曲线化，起止两端渐隐消散于空间。
- **内联 / 顶栏 Logo SVG**（用 `currentColor` 自动适配明暗模式，同时保存独立版到 `static/images/mark.svg` 作为 favicon，favicon 建议用 `#e5a93c` 显式颜色）：

```svg
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="brand_e1" x1="16" y1="9" x2="36.5" y2="13.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="currentColor" stop-opacity="0" />
      <stop offset="100%" stop-color="currentColor" stop-opacity="0.62" />
    </linearGradient>
    <linearGradient id="brand_e2" x1="36.5" y1="13.5" x2="25.5" y2="19.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="currentColor" stop-opacity="0.62" />
      <stop offset="100%" stop-color="currentColor" stop-opacity="1" />
    </linearGradient>
    <linearGradient id="brand_e5" x1="14" y1="39" x2="40" y2="29.5" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="currentColor" stop-opacity="0.96" />
      <stop offset="55%" stop-color="currentColor" stop-opacity="0.52" />
      <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
    </linearGradient>
  </defs>
  <path d="M16 9 H34 Q41 9 36.5 13.5" stroke="url(#brand_e1)" stroke-width="2.5" stroke-linecap="round" />
  <path d="M36.5 13.5 L33 17 Q30.5 19.5 25.5 19.5" stroke="url(#brand_e2)" stroke-width="2.6" stroke-linecap="round" />
  <path d="M25.5 19.5 H14 Q8 19.5 8 25.5 V33 Q8 39 14 39" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" />
  <path d="M14 39 H25.5 Q30.5 39 34 35.5 L40 29.5" stroke="url(#brand_e5)" stroke-width="2.6" stroke-linecap="round" />
</svg>
```

### 2. 暖金测绘配色 Token（默认暗色，支持亮色切换）

| Token | Dark（默认） | Light（工程稿纸） | 用途 |
|---|---|---|---|
| `--bg` | `#121110` | `#f5f2eb` | 页面主背景 |
| `--surface` | `#1a1916` | `#fcfaf5` | 卡片 / 模块底色 |
| `--surface-2` | `#24221e` | `#ebe6db` | hover / 表头 / 视觉区底色 |
| `--ink` | `#f0ede6` | `#181715` | 主文字 |
| `--muted` | `#a6a095` | `#666158` | 辅助文字 / 摘要 |
| `--line` | `#312e28` | `#d6cfc2` | `1px` 细实线网格边界 |
| `--accent` | `#e5a93c` | `#9e6810` | 主强调色（暖金 / 深铜金） |
| `--accent-ink` | `#171207` | `#fcfaf5` | 强调按钮上的文字色 |
| `--accent-soft` | `rgba(229,169,60,0.14)` | `rgba(158,104,16,0.12)` | 标签微底色 |
| `--secondary-accent` | `#68b5e8` | `#226699` | 辅助工程蓝（回环弧线/次级强调） |
| `--code-bg` | `#0c0b0a` | `#171614` | 代码块底色（始终深色以兼容 Shiki `dark-plus`） |
| `--panel-bg` / `--panel-ink` | `#ede9df` / `#141311` | `#181715` / `#f5f2eb` | 首页右侧反色 `LIVE INDEX` 统计面板 |

### 3. 排版与几何语言

- **三字体系统**：
  - 衬线标题：`Noto Serif SC`（`600/700/900`）+ 本地宋体回退；
  - 正文无衬线：`Manrope` + `PingFang SC` / `Noto Sans SC`；
  - 眉标 / 日期 / 编号 / 代码：`DM Mono` + `JetBrains Mono`。
- **界面骨架**：最大容器宽度 `1160px`（`width: min(1160px, calc(100% - 44px))`），直角边界 + `1px solid var(--line)` 分隔，取消卡片圆角和大投影，靠留白和排版层级建立秩序。

---

## 三、信息架构与页面设计

### 顶部导航栏（全站固定）

左侧：**方案 P SVG Logo + `ZERO / SPATIAL NOTES`**  
主导航（严格按以下顺序）：
1. **首页** → `/`
2. **博客** → `/posts/`
3. **学习系列** → `/projects/`
4. **时间轴** → `/archive/`
5. **关于** → `/about/`

右侧操作按钮：
- `⌕` 快捷检索按钮（跳转到 `/posts/#filter` 并自动聚焦搜索框；在博客页按键盘 `/` 也可直接聚焦）；
- `◐` 明暗主题切换按钮（读写 `localStorage` 的 `zero-theme`，并在 `<head>` 内联极简防闪烁脚本）。

### 各页面具体规范

#### 1. 首页（`layouts/index.html`）
- **Hero 区**：
  - 背景：极淡坐标网格 + 专属 **LiDAR 极坐标扫描环 / 稀疏点云 / 关键帧位姿轨迹 + BTC 回环虚线** SVG 装饰（直接复用 `redesign-preview.html` 中的 `.slam-motif`）；
  - 左侧：眉标 `ROBOTICS & SPATIAL INTELLIGENCE`、大衬线标题 `从传感器信号 / 到空间理解。`、简介与主/次按钮（浏览全部博客、查看学习系列与项目、按时间轴回看）；
  - 右侧：反色 `LIVE INDEX` 实时面板，由 Hugo 动态计算：
    - 博客总数（`len (where site.RegularPages "Section" "posts")`）
    - SLAM 核心文章数（统计 `SLAM` 分类）
    - 学习系列 / 项目数（`len (where site.RegularPages "Section" "projects")`）
  - 底部：领域 `Ticker` 条（`LIDAR-IMU ODOMETRY` / `IESKF` / `VOXEL MAP` / `BTC LOOP CLOSURE` / `GTSAM` / `INTEL TBB` / `ROS & EDGE AI`）。
- **最近更新的博客**：展示最新 6 篇文章的 3 列网格卡片（右上年月、左上日序号、标题、摘要、分类标签、阅读链接）。
- **知识方向索引带（`WHAT LIVES HERE`）**：`01~04` 核心分类行（动态输出对应文章数），点击带参数跳到 `/posts/?category=SLAM` 等自动筛选。
- **底部双入口卡片**：分别导向「学习系列与开源项目」和「时间轴」。

#### 2. 博客页（`layouts/posts/list.html`，参考 `leager-zju.github.io/notes/`）
- **顶部 Section Hero**：眉标 `KNOWLEDGE BASE / 01` + 标题 `博客` + 右侧大号总数计数器 `XX entries`。
- **交互工具栏（`#filter`）**：
  - 即时搜索框（带 `⌕` 与 `<kbd>/</kbd>`，支持按标题、摘要、分类、标签即时客户端过滤，零额外依赖）；
  - 分类筛选 Chip 栏（`全部` + 从 `posts` 实际文章动态聚合的所有分类及数量，按文章数降序排列）；
  - 支持读取 URL Query `?category=XXX`，与首页方向索引带和文章页分类标签无缝联动。
- **筛选结果计数**（`显示 N / 总数 篇文章`）+ **全量 3 列文章卡片网格** + 无结果时的空状态提示。

#### 3. 学习系列页（`layouts/projects/list.html` + `content/projects/`）
- **定位**：集中展示个人项目介绍、核心特性、技术栈标签和外部仓库/主页链接。
- **数据驱动结构**：每新增一个项目，只需在 `content/projects/<slug>.md` 新增一个 Markdown 文件（Frontmatter 包含 `title`, `date`, `status`, `badge`, `summary`, `highlights`, `stack`, `repo`, `demo` 等字段）。
- **首批占位项目**：创建 `content/projects/dsh-web-update.md`：
  - 项目名：`dsh-web-update`
  - 简介：Linux 平台 DeepSeek Harness Web（`dsh web`）一键更新插件，启动及每 24 小时检查 npm 新版，侧边栏底部原生风格徽标提示，二次确认后自动安装并重启刷新。
  - 技术栈：`["JavaScript", "Node.js", "npm", "Linux", "DeepSeek Harness"]`
  - 链接：`https://github.com/Zero-Kq/dsh-web-update`（GitHub 仓库）与 `https://www.npmjs.com/package/dsh-web-update`（npm 主页）。

#### 4. 时间轴页（`layouts/archive/list.html` + `content/archive/_index.md`）
- 参考 `leager-zju.github.io/archive/`：
- 顶部 Section Hero（`TIMELINE / COMPLETE LOG` + `时间轴` + 总篇数）；
- 使用 Hugo `(.Where site.RegularPages "Section" "posts").GroupByDate "2006"` 按年份倒序分组：左侧吸顶大号等宽年份，右侧细线清单（`MM.DD` + 标题 + 分类标签 + `→`）。

#### 5. 关于页（`layouts/about/single.html` + `content/about/index.md`）
- 顶部 Section Hero（`ABOUT THE AUTHOR` + `关于`）；
- 两栏编辑排版：左侧由 `content/about/index.md` 正文渲染（个人方向、站点定位与技术栈），右侧联系方式与开源链接卡片（`GitHub · Zero-Kq`、`Pages 仓库`、`dsh-web-update`，彻底移除旧配置中 `x.com/你的X用户名`、`buymeacoffee.com/你的ID` 占位链接）。

#### 6. 文章详情页（`layouts/_default/single.html`）
- 顶部细线阅读进度条（`2px` 暖金色）；
- 面包屑（`首页 / 博客 / 当前文章`）+ 文章头（分类/日期眉标、大衬线标题、描述导语、发布日期/预计阅读时长/标签）；
- 宽屏两栏布局（正文最大宽度 `780px` + 右侧吸顶目录 `.TableOfContents`，自动高亮当前阅读章节）；
- 排版细节：
  - 公式容器支持横向滚动防止超长公式撑破移动端；
  - 表格使用细线暖金表头 + 横向滚动包裹；
  - 代码块（`.highlight`）保持深色背景 + 语言角标 + 一键复制按钮；
  - 底部提供上一篇 / 下一篇导航。

---

## 四、必须注意的工程兼容性清单（防踩坑）

1. **`/Pages/` 子路径适配（最关键）**：
   - `baseURL` 是 `https://Zero-Kq.github.io/Pages/`，GitHub Actions 也会传入 `--baseURL`。
   - **所有**导航链接、CSS/JS 路径、SVG/图片路径都必须使用 Hugo `relURL` / `RelPermalink`（或 `resources.Get` Pipes 产出的 `.RelPermalink`），**绝对不要写死 `/posts/`、`/css/...`**。
2. **Shiki 代码高亮管线零破坏**：
   - 保留 `layouts/_default/_markup/render-codeblock.html`（确保非 mermaid 代码块仍经由 `transform.Highlight` 输出 `.highlight code[data-lang]`，供 `scripts/shiki-highlight.mjs` 后处理替换）。
   - 保留 `package.json`、`scripts/build.mjs`、`scripts/preview.mjs`、`scripts/shiki-highlight.mjs`。
   - 新 CSS 中给 `.highlight` / `.highlight pre` 设置 `background: var(--code-bg)`（暗/亮模式均为深色底），避免亮色模式下 `dark-plus` 浅色代码看不清。
3. **KaTeX 与 Mermaid 兼容升级**：
   - 将原 `layouts/partials/extend_head.html` 中的 KaTeX（`and .IsPage (.Param "math")`）和 Mermaid（`and .IsPage (in .Content "class=\"mermaid\"")`）迁入新 `layouts/partials/head.html`。
   - 为 Mermaid 根据当前 `data-theme` 自动切换 `dark` / `neutral` 主题（或通过暖金 `themeVariables` 统一风格）。
4. **清理冗余与占位项**：
   - 清理 `hugo.toml` 中 PaperMod 专属参数（`theme = 'PaperMod'`、`profileMode`、`homeInfoParams`、假 Twitter/Ko-fi 链接）；
   - 检查 `content/posts/demo/` 两篇入门测试文章，可标记 `draft = true`（并在生产构建命令或配置中决定是否排除）或归入其他分类；
   - 更新 `.github/workflows/gh-pages.yml`：将 Workflow 名称更新并去掉多余的 PaperMod submodule 注释，保持 `npm ci && npm run build -- --baseURL ...` 流程不变；
   - 同步更新 `CLAUDE.md` 中的架构说明（记录已切换为自研暖金模板）。

---

## 五、目标目录结构

```text
/home/yj/Z-person/Pages/
├── hugo.toml                              # 精简后的主配置（移除 theme = 'PaperMod'，配置 5 项主菜单）
├── assets/
│   ├── css/site.css                       # 统一暖金 Design Token 与全站响应式样式（Hugo Pipes 压缩+指纹）
│   └── js/site.js                         # 主题切换、博客实时筛选/搜索、快捷键 /、阅读进度、代码复制
├── static/
│   └── images/mark.svg                    # 方案 P（双端入雾孤线）独立 SVG Favicon
├── content/
│   ├── about/index.md                     # 完善后的关于页正文
│   ├── archive/_index.md                  # 时间轴页面入口
│   ├── projects/
│   │   ├── _index.md                      # 学习系列页面入口
│   │   └── dsh-web-update.md              # 首个真实开源项目卡片
│   └── posts/...                          # 原样保留全部现有技术文章
├── layouts/
│   ├── _default/
│   │   ├── baseof.html                    # 统一骨架（防闪烁主题脚本 + header + main + footer）
│   │   ├── list.html                      # 通用列表回退模板（复用博客筛选卡片）
│   │   ├── single.html                    # 文章详情页（宽屏阅读器 + 右侧吸顶 TOC + 上下篇）
│   │   └── _markup/
│   │       └── render-codeblock.html      # 保留！兼容 Mermaid 与 Shiki
│   ├── index.html                         # 策展型暖金首页
│   ├── posts/list.html                    # 博客页（参考 Leager /notes/：计数+搜索+分类芯片+卡片网格）
│   ├── projects/list.html                 # 学习系列 / 项目页
│   ├── archive/list.html                  # 按年份分组时间轴页
│   ├── about/single.html                  # 双栏编辑风关于页
│   └── partials/
│       ├── head.html                      # Meta / Fonts / Hugo Pipes CSS / 按需 KaTeX & Mermaid
│       ├── header.html                    # 方案 P 内联 Logo + 5 项导航 + 搜索/主题按钮
│       ├── footer.html                    # 三栏编辑页脚
│       └── post-card.html                 # 复用文章卡片组件
└── scripts/                               # 保留现有 build.mjs / preview.mjs / shiki-highlight.mjs
```

---

## 六、分阶段实施与验收清单

- **Phase 1 · 建分支与清理配置**：`git checkout -b feat/warm-amber-redesign`，更新 `hugo.toml`，新增 `static/images/mark.svg`、`content/projects/`、`content/archive/_index.md`、`content/about/index.md`。
- **Phase 2 · 编写样式与交互脚本**：依据 `redesign-preview.html` 落地 `assets/css/site.css`（完整补齐文章页排版、Shiki 代码块、KaTeX、Mermaid、移动端折叠导航）与 `assets/js/site.js`。
- **Phase 3 · 编写全套 Hugo 模板**：落地 `baseof.html`、`partials/*`、`index.html`、`posts/list.html`、`projects/list.html`、`archive/list.html`、`about/single.html`、`single.html`，移除旧 PaperMod 覆盖文件与 `themes/PaperMod`。
- **Phase 4 · 本地完整构建与验证**：
  - 运行 `npm run build` 确认 Hugo 构建 + Shiki 后处理 0 报错；
  - 运行 `npm run dev`（或本地静态服务）逐页验证：
    1. 首页：方案 P Logo、LiDAR SVG 母题、LIVE INDEX 动态数字、方向跳转；
    2. 博客页：`/` 快捷键、实时搜索、分类筛选、URL `?category=` 参数；
    3. 学习系列页：`dsh-web-update` 卡片与 GitHub/npm 外链；
    4. 时间轴 & 关于页：年份排序、链接正确且均带 `/Pages/` 前缀；
    5. 文章页（重点抽检 `ieskf-standard-workflow`、`zlio-tbb-observation-parallel`、`hugo-advanced-visualization`）：KaTeX 公式、Shiki 代码高亮、Mermaid 流程图、TOC 跳转、代码复制；
    6. 明暗主题切换持久化 + 移动端响应式布局。
- **Phase 5 · 收尾**：删除临时预览文件（或保留在 `.gitignore`），更新 `CLAUDE.md` 与 `gh-pages.yml`，确认无误后合并到 `main` 触发 GitHub Pages 部署。
