---
title: "Liuyao（观象 · 六爻手记）"
date: 2026-11-26
draft: false
status: "ACTIVE · WEB LAB"
badge: "STATIC WEB · GIST SYNC"
year: "2026"
summary: "纯静态网页数据持久化实验项目。以六爻起卦与断象手记为载体，验证在无自建后端的 GitHub Pages 环境下，如何通过浏览器 localStorage 与 GitHub 私有 Gist 实现本地优先与跨设备同步。"
highlights:
  - "本地优先存储：默认写入浏览器 localStorage 并支持 JSON 导入导出，无需登录即可完整使用与复盘"
  - "私有 Gist 云同步：采用仅含 gists 读写权限的细粒度 PAT，直连 api.github.com 完成双向合并与软删除"
stack:
  - "HTML5"
  - "JavaScript"
  - "GitHub Pages"
  - "localStorage"
  - "GitHub Gist API"
repo: "https://github.com/Zero-Kq/Liuyao"
demo: "https://zero-kq.github.io/Liuyao/"
demoLabel: "在线体验"
---
