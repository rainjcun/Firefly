---
title: "Cloudflare IP优选"
published: 2026-05-03
updated: 2026-05-03
description: Cloudflare IP优选
image: /src/assets/images/cover.avif
tags: [IP优选]
category: IP优选
draft: false
author: fqzlr
---

## 一、Cloudflare IP优选

### 步骤1：添加路由规则

1. 登录Cloudflare账号，进入你绑定的Astro博客域名控制台（左侧导航栏选择对应域名）。
2. 找到左侧导航栏的**路由（Rules）**，点击进入后选择「转换规则」或「路由」（按当前Cloudflare界面显示为准）。
3. 点击「添加路由」，进入路由配置页面。
4. 路由地址填写：`你的Astro域名/*`（示例：`blog.xxx.com/*`），含义是匹配Astro博客的所有页面（包括文章、静态资源），统一走优选节点。
5. 无需额外添加规则，直接保存并确认路由配置。

### 步骤2：配置DNS解析（关键步骤）

1. 在Cloudflare域名控制台，找到左侧导航栏的**DNS → 记录**，点击进入。
2. 点击「添加记录」，开始配置优选解析。
3. 记录类型：选择「A记录」或「CNAME」均可。
4. 名称：可自定义前缀（如cdn、speed、ip），用于标识优选节点（示例：`speed.xxx.com`）。
5. 目标：填写UP主提供的Cloudflare优选节点/地址（格式：任意文字或字母.cf.090227.xyz，直接复制粘贴，确保地址正确）。
6. 代理状态：**必须关闭云朵图标（即关闭Cloudflare代理）**，否则优选无效。
7. 点击「保存」，完成优选解析记录添加。

### 步骤3：绑定Astro主域名到优选节点

1. 再次点击「添加记录」，配置Astro主域名的解析。
2. 记录类型：与上一步一致（A记录/CNAME）。
3. 名称：填写Astro主域名前缀（如blog，即`blog.xxx.com`，若为根域名则填写`@`）。
4. 目标：填写上一步创建的优选记录名称（示例：`speed.xxx.com`），将主域名指向优选节点。
5. 代理状态：保持关闭（与上一步一致）。
6. 点击「保存」，等待1-3分钟解析生效，刷新Astro博客即可感受到访问速度提升。

> 原理：Astro博客主域名 → Cloudflare优选地址 → Cloudflare最优节点，自动选择国内延迟最低的IP，减少静态资源（Astro生成的HTML、CSS、图片）加载耗时。

---

## 二、Astro博客Markdown文章编写与发布

Astro博客的文章均以Markdown格式编写，核心需遵循Astro的Frontmatter元数据规范，以下步骤完全适配Astro框架，新手可直接复刻。

### 1. 文章存放位置（Astro固定路径）

- 所有Markdown文章，需放在Astro项目源码的 `src/content/posts/` 文件夹下（若没有posts文件夹，可手动创建，Astro默认读取该路径下的文章）。
- 文章格式：必须是**纯Markdown文件（后缀为.md）**，文件名建议用英文/拼音（如`astro-blog-guide.md`），避免中文乱码。
- 图片、附件等资源：统一放在 `src/content/posts/images/` 或 `src/assets/` 文件夹下（推荐前者，方便管理），引用时使用相对路径。

### 2. 文章必备元数据（Astro Frontmatter规范）

每篇Markdown文章顶部，必须编写固定格式的Frontmatter元数据（用---包裹），适配Astro的文章渲染逻辑，示例如下（可直接复制修改）：

```markdown
---
title: 文章标题（如：Astro博客部署全流程指南）
date: 2026-05-03 19:00:00
description: 文章简短描述（100字内，用于SEO和文章列表展示）
cover: /src/content/posts/images/cover.jpg
tags: [Astro, 静态博客, 部署]
categories: 技术教程
draft: false
author: 作者名
pubDate: 2026-05-03 19:00:00
---
```
元数据字段说明
- title：文章标题，必填，将作为博客文章的标题展示。
- date：文章发布时间，格式为YYYY-MM-DD HH:MM:SS，适配Astro时间渲染。
- description：文章简短描述，控制在100字内，用于SEO优化和博客文章列表展示。
- cover：文章封面图路径，可填写本地相对路径（需对应资源存放位置）或网络图片链接。
- tags：文章标签，用英文逗号分隔并包裹在中括号内，适配Astro标签功能，方便分类检索。
- categories：文章分类，可自定义，用于博客文章分类展示。
- draft：草稿状态，true为草稿（不显示在博客），false为正式发布（必填）。
- author：作者名，可选，适配Astro作者展示功能。
- pubDate：可选，与date一致即可，部分Astro主题需配置以正常显示发布时间。
3. Astro支持的Markdown功能（适配文章编写）
Astro完全支持标准Markdown语法，可正常使用标题（# ~ ######）、段落、列表（有序/无序）、代码块（```包裹）、链接、图片、引用（>）等功能，同时支持GFM扩展语法（如表格、任务列表），可满足日常文章编写需求，无需额外配置。
4. 推荐编辑器（适配Astro，二选一）
1. VS Code（推荐，适配Astro开发）：原生支持Astro项目结构，可安装Markdown预览插件，实现语法高亮、实时预览，同时可编辑Astro项目代码，适合兼顾开发与写作的用户。
2. Obsidian（OC，适合纯写作）：可视化编辑，实时预览Markdown效果，无需记忆语法，适合不想接触代码的新手；可将Obsidian的文章文件夹，与Astro项目的src/content/posts/文件夹关联，编写完成后直接同步，无需手动复制。