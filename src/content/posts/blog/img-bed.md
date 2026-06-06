---
title: "Cloudflare Workers 部署 Cloudflare‑ImgBed 图床完整教程"
published: 2026-05-07
updated: 2026-05-07
description: 搭建属于自己的图床
image: /src/assets/images/cover.avif
tags: [图床]
category: 博客
draft: false
author: fqzlr
---
# Cloudflare Workers 部署 Cloudflare‑ImgBed 图床完整教程

本文基于[官方文档](https://cfbed.sanyue.de/deployment/worker.html))，从零教你用 **Cloudflare Workers** 部署专属图床，全程免费、无服务器、支持自动更新。

---
## 一、什么是图床？为什么选 Cloudflare‑ImgBed？

### 1\. 图床是什么

图床 = 专门存放图片并生成**可直接访问的 URL** 的服务，用于博客、公众号、文档、笔记，Markdown 等场景，解决图片统一托管、跨平台复用、链接长期有效问题。
### 2\. 为什么选本方案
- 零成本：Cloudflare 免费额度足够个人日常使用
- 无服务器：不用买主机、不用配置环境
- 全球加速：Cloudflare CDN 全球节点，访问快
- 数据可控：自己部署、自己管理，不怕第三方图床跑路
- 多存储：支持 R2、Telegram、D1/KV 数据库
- 自动部署：GitHub Actions 一键部署 \+ 自动更新
### 3\. Pages vs Workers（本教程选 Workers）
   可以做ip优选
---
## 二、部署前期准备
1. **账号准备**
    - GitHub 账号（用于 Fork 项目、存 Secrets）
    - Cloudflare 账号（免费注册即可）
1. **必备信息**（后面会一步步拿）
    - Cloudflare Account ID
    - Cloudflare API Token（权限：编辑 Workers）
    - KV 或 D1 数据库 ID（二选一）
    - 可选：R2 存储桶名、Telegram 机器人信息
1. **工具**
浏览器即可，无需本地环境、无需终端。
---
## 三、完整部署步骤（按顺序做）
 一步：Fork 开源项目
1. 打开官方项目：[CloudFlare ImgBed](https://github.com/MarSeventh/CloudFlare-ImgBed)
2. 点右上角 **Fork** → 选择你的 GitHub 账号 → 等待 Fork 完成。
---
### 第二步：准备 Cloudflare 资源
#### 2\.1 获取 Account ID \+ API Token
1. 登录 Cloudflare Dashboard
2. 右上角头像 → **我的个人资料** → **API 令牌**
3. **创建令牌** → 选模板 **编辑 Cloudflare Workers** → 下一步 → **创建令牌**
4. 复制并保存生成的 **API Token**（只出现一次）
5. 返回 Dashboard 首页，右侧找到并复制 **Account ID**。
#### 2\.2 创建数据库（KV 或 D1 二选一）
##### 方案 A：KV 数据库（读写更快）
1. 存储和数据库 → Workers KV → **创建实例**
2. 名称填 `img_url` → 创建
3. 复制 **命名空间 ID**
##### 方案 B：D1 数据库（免费额度更高）

1. 存储和数据库 → D1 SQL 数据库 → **创建数据库**
2. 名称填 `img_d1` → 创建
3. 复制 **数据库 ID**
4. 进入「控制台」执行项目提供的 `init.sql` 初始化语句
#### 2\.3（可选）创建 R2 存储桶
1. 存储和数据库 → R2 对象存储 → **创建存储桶**
2. 自定义名称，复制保存 **存储桶名称**
---
### 第三步：配置 GitHub Secrets（关键）

1. 进入你 Fork 的仓库
2. Settings → Secrets and variables → Actions → **New repository secret**
3. 按表添加，**必填项必须填**，二选一填一个即可

|Secret 名称|说明|是否必填|
|---|---|---|
|CLOUDFLARE_API_TOKEN|Cloudflare API 令牌|✅ 必填|
|CLOUDFLARE_ACCOUNT_ID|Cloudflare 账户 ID|✅ 必填|
|KV_NAMESPACE_ID|KV 命名空间 ID|KV/D1 二选一|
|D1_DATABASE_ID|D1 数据库 ID|KV/D1 二选一|
|R2_BUCKET_NAME|R2 存储桶名|可选|
|WORKER_NAME|Worker 名称（默认 cloudflare\-imgbed）|可选|
|WORKER_VARS|业务变量（JSON 格式，如 TG 配置）|可选|

- 安全提醒：一律用 **Secrets**，不要用 Variables（公开可见）。
---
### 第四步：运行部署（手动 / 自动二选一）

#### 方式 1：手动触发部署
1. 进入仓库 **Actions** 页面
2. 左侧选择 **Deploy to Cloudflare Workers**
3. 点 **Run workflow**
4. 分支选 main → 直接 **Run workflow**
5. 等待执行成功（约 1–3 分钟）
#### 方式 2：开启自动部署（推荐）
1. Actions 页面找到 **Upstream Sync**
2. 点 **Enable workflow**
3. 以后上游更新 → 自动同步 main → 自动部署，全程不用管
---
## 四、部署成功 ; 访问使用
- 访问地址：``
- 部署后**必须配置存储渠道**（R2/Telegram 等）才能上传图片，在后台管理面板配置即可。

---
## 五、后续更新维护

### 1\. 自动更新（推荐）
保持 Upstream Sync 开启，上游更新自动同步并部署。
### 2\. 手动更新

1. 仓库点 **Sync fork** 同步上游
2. 触发自动部署；或手动再跑一次 Deploy workflow。
---

## 六、常见问题
1. 部署失败：检查 Secrets 是否填错、权限是否正确
2. 无法上传：未配置存储渠道，去后台绑定 R2 或 Telegram
3. 链接打不开：确认 Worker 已启用、名称与子域名拼写正确

---
## 七、总结

用 Cloudflare Workers 部署图床，**全程免费、无服务器、10 分钟搞定**，适合个人长期稳定使用。按本文步骤：Fork → 拿 Cloudflare 信息 → 配 GitHub Secrets → 一键部署，即可拥有专属高速图床。

