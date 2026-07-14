---
title: Firefly 友链自助申请自动化
published: 2026-04-27
updated: 2026-04-27
description: 从 Issue 表单、GitHub Actions、Playwright 校验，到自动写入 friendsConfig.ts、格式化、提交与回评，这篇文章完整拆解 Firefly 友链自助申请的实现原理、关键代码和落地步骤。
tags:
  - Playwright
  - 友链
  - 自动化
  - Firefly
category: "转载"
draft: false
author: fqzlr
originalUrl: ""
originalAuthor: "原作者"
---

# Firefly 友链自助申请自动化 
> [!TIP]
> 原教程来自upxuu
> https://upxuu.com/posts/friend-link-system




这篇文章把我这次在 Firefly 里落地的“友链自助申请”方案完整拆开讲一遍。

目标很简单：

1. 访客不需要私聊站长，直接在 GitHub 仓库里点一个 Issue 模板。
2. 填完网站名称、网站链接、友链页面 URL 等信息后，GitHub Actions 自动开始校验。
3. 系统会自动检查对方站点是否真的加了本站友链。
4. 校验通过后，自动把友链写入 `src/config/friendsConfig.ts`。
5. 自动格式化、自动提交、自动推送，并在 Issue 里回评结果。

如果你也想在自己的博客里做一套类似的“自助申请友链”系统，这篇文章可以直接照着抄。

---

## 一、最终效果是什么

这套方案上线后，整个流程会变成这样：

1. 用户打开 GitHub 仓库里的“申请友链” Issue 模板。
2. 填写以下信息：
   - 网站名称
   - 网站链接
   - 友链页面 URL
   - 网站描述
   - 网站头像 URL
3. 用户提交 Issue。
4. GitHub Actions 监听到 `issues.opened` 事件后自动运行。
5. 工作流先给 Issue 打上“验证中”标签。
6. 脚本使用 Playwright 访问对方填写的友链页面。
7. 校验两件事：
   - 这个页面能不能正常打开
   - 页面里有没有本站的回链
8. 如果校验失败：
   - 在 Issue 里自动评论失败原因
   - 给 Issue 打上 `needs-update`
9. 如果校验成功：
   - 自动更新 `src/config/friendsConfig.ts`
   - 自动运行 Biome 格式化
   - 自动提交到仓库
   - 自动推送到默认分支
   - 在 Issue 里评论“已添加成功”
   - 自动关闭 Issue

评论重新验证也支持：

1. 如果申请者后来修好了友链页面，只需要回复这个 Issue。
2. Workflow 会监听 `issue_comment.created`。
3. 但只有 **Issue 作者本人** 的评论才会触发重新验证，避免别人乱刷。

---

## 二、这套系统的核心原理

这套自动化其实不是“一个脚本干完所有事”，而是四层拼起来的：

## 1. GitHub Issue 模板负责收集表单

你不需要自己写前端表单，也不需要数据库。

GitHub 自带的 Issue Forms 就能帮你把申请信息收上来。  
用户填完表单后，GitHub 会把内容渲染成一段结构化文本，放进 Issue body。

我们后面的脚本做的事情，本质上就是：

- 读取 `context.payload.issue.body`
- 从里面解析出“网站名称 / 网站链接 / 友链页面 URL / 描述 / 头像”

所以第一层原理很朴素：

> GitHub Issue 不是单纯的“提问题”，它也可以被当成一个零后端表单系统。

---

## 2. GitHub Actions 负责事件驱动

第二层是 GitHub Actions。

它的职责不是写业务逻辑，而是：

- 监听事件
- 准备运行环境
- 安装依赖
- 调用真正的处理脚本

这里我们监听两个事件：

```yml
on:
  issues:
    types: [opened, reopened]
  issue_comment:
    types: [created]
```

这意味着：

- 新建 Issue 时自动跑一次
- 重新打开 Issue 时自动跑一次
- 在 Issue 下面评论时也会跑一次

但后面脚本里会再做一层筛选，只允许作者自己的评论触发重新验证。

---

## 3. `actions/github-script` 负责把 GitHub 上下文交给本地脚本

很多人会把全部逻辑都塞进 YAML 里的 `script: |`，但这样很容易炸：

- YAML 缩进难维护
- JS 代码太长可读性差
- 混入 `#` 注释时容易直接变成语法错误
- 编码和引号很容易出坑

所以这次的做法是：

1. Workflow 里只保留一个很短的入口。
2. 真实逻辑放到独立文件 `.github/scripts/process-friend-request.cjs`。

现在入口只有这一小段：

```yml
- name: Process friend request
  uses: actions/github-script@v7
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    script: |
      const path = require('node:path');
      const handler = require(path.join(process.env.GITHUB_WORKSPACE, '.github/scripts/process-friend-request.cjs'));
      await handler({ github, context, core });
```

这段代码只做一件事：

> 把 `github`、`context` 这些 GitHub Runtime 对象传给仓库里的本地脚本。

于是业务逻辑就从“YAML 内联脚本”变成了“普通 Node.js 文件”，维护体验会好很多。

---

## 4. Playwright 负责做浏览器级校验

为什么不用 `fetch` 直接请求页面？

因为友链页面场景更适合浏览器级校验：

- 有些站点会跳转
- 有些内容是客户端渲染出来的
- 有些友链列表在真实 DOM 渲染后才出现
- 只看 HTML 源码不一定能确认页面最终长什么样

所以这里用了 Playwright：

```js
const { chromium } = require("playwright");
```

校验逻辑分成两步：

1. 用浏览器打开对方提供的友链页面
2. 检查页面内容和页面上的所有链接里，是否出现本站域名或本站名称

也就是说它不是纯字符串比较，而是近似模拟了一个真实用户打开页面之后看到的结果。

---

## 三、当前实现依赖哪些文件

如果你要在自己的项目里复刻这套系统，主要会改下面这些文件。

## 1. `.github/ISSUE_TEMPLATE/friend-request.yml`

作用：定义“申请友链”表单。

这个文件负责告诉 GitHub：

- 模板标题是什么
- 默认标签是什么
- 需要用户填写哪些字段

你至少要保留这些字段：

- 网站名称
- 网站链接
- 友链页面 URL

描述和头像可以设为可选。

---

## 2. `.github/workflows/friend-link-checker.yml`

作用：定义自动化工作流。

它主要负责：

- 监听 Issue / 评论事件
- 安装 Node.js
- 安装 pnpm
- 安装项目依赖
- 安装 Playwright Chromium
- 调用处理脚本

这个文件是系统的“总开关”。

---

## 3. `.github/scripts/process-friend-request.cjs`

作用：真正的核心业务逻辑。

它做了几乎所有关键工作：

- 解析 Issue 内容
- 校验 URL
- 使用 Playwright 检查友链页
- 解析现有 `friendsConfig.ts`
- 生成新的友链对象
- 写回配置文件
- 运行 Biome 格式化
- Git 提交与推送
- 在 Issue 里评论成功/失败
- 打标签和关闭 Issue

可以把它理解成这套系统的“应用层”。

---

## 4. `src/config/friendsConfig.ts`

作用：真正保存友链数据。

这个仓库不是写入 JSON，而是直接更新 TypeScript 配置文件里的数组：

```ts
export const friendsConfig: FriendLink[] = [
  {
    title: "站点名",
    imgurl: "头像地址",
    desc: "描述",
    siteurl: "https://example.com/",
    tags: ["Blog"],
    weight: 10,
    enabled: true,
    issue_id: 123,
  },
];
```

所以自动化脚本必须知道这个文件的格式，并按它的结构生成内容。

---

## 5. `.github/workflows/biome.yml`

作用：保证自动写入后的文件仍然符合代码格式规范。

这一步非常重要，因为如果脚本写入的内容格式不稳定，CI 会红，自动化虽然成功写入了数据，但 PR / 提交质量检查会挂掉。

---

## 四、完整执行链路

这里按一次“用户申请友链”的真实时间顺序讲。

## 第 1 步：用户提交申请

用户点击 GitHub Issue 模板，生成一条“友链申请” Issue。

Issue body 里会包含类似下面的结构：

```md
### 网站名称
My Blog

### 网站链接
https://example.com

### 友链页面 URL
https://example.com/friends

### 网站描述
记录技术与生活

### 网站头像 URL
https://example.com/avatar.png
```

这一步不需要额外后端，GitHub 自己就帮你把数据存下来了。

---

## 第 2 步：Workflow 被触发

`.github/workflows/friend-link-checker.yml` 被触发。

它会在 Ubuntu Runner 上做这些准备工作：

```yml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- uses: pnpm/action-setup@v4
- run: pnpm install --frozen-lockfile
- run: pnpm exec playwright install --with-deps chromium
```

这几步分别解决：

- 拉代码
- 提供 Node 环境
- 提供 pnpm
- 安装仓库依赖
- 安装 Playwright 所需浏览器

---

## 第 3 步：脚本判断这是不是友链申请

在 `process-friend-request.cjs` 里，脚本首先读取：

- `context.eventName`
- `context.payload.action`
- `context.payload.issue.body`

然后判断：

```js
const isFriendRequest = body.includes("### 网站名称") && body.includes("### 网站链接");
```

如果不是友链申请，直接跳过。

这样做的好处是：

- 这个 workflow 可以挂在 `issues` 事件上
- 但不会误处理其他普通 Issue

---

## 第 4 步：打“验证中”标签

如果是新建或重新打开的 Issue，先打一个标签：

```js
await github.rest.issues.addLabels({
  owner,
  repo,
  issue_number: issueNumber,
  labels: ["验证中"]
});
```

这一步主要是用户体验优化。

访客一看标签，就知道系统已经开始处理，不需要站长人工回复“我看到了”。

---

## 第 5 步：解析 Issue 表单

解析逻辑在 `parseIssueBody(body)`。

这个函数做了两件事：

1. 按 Markdown 标题识别字段
2. 容忍一些不同写法

它会兼容这些字段名称：

- 网站名称 / 名称 / 站点名称
- 网站链接 / 站点链接 / 链接 / 网址 / 地址
- 友链页面 / 友链地址
- 网站描述 / 描述 / 简介
- 网站头像 / 头像 / 图标
- 网站标签 / 标签 / 分类

这样做的意义是：

- 模板稍微改字，不至于整套系统失效
- 用户手动编辑 Issue 内容时，也更不容易把解析搞崩

解析结束后会得到一个统一结构：

```js
{
  site_name,
  site_url,
  friend_page_url,
  site_desc,
  site_avatar,
  site_tag
}
```

---

## 第 6 步：先校验 URL 合法性

在真正访问网站前，脚本先用 `new URL()` 规范化地址：

```js
function normalizeUrl(value) {
  try {
    return new URL(value.trim()).toString();
  } catch {
    return "";
  }
}
```

如果用户填了无效 URL，就直接回评，不继续往后跑。

这样能省掉很多无意义的浏览器启动和网络请求。

---

## 第 7 步：用 Playwright 校验友链页面

`validateFriendPage(pageUrl)` 是整个流程最关键的函数之一。

它主要做四件事：

### 1. 启动无头 Chromium

```js
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"]
});
```

### 2. 打开用户提供的友链页

```js
response = await page.goto(pageUrl, {
  waitUntil: "domcontentloaded",
  timeout: 12000
});
```

### 3. 做失败重试

脚本不是只试一次，而是会重试 3 次，中间等待 2 秒。

这样能降低这类波动造成的误判：

- 短时网络抖动
- 对方站点首包慢
- CDN 临时超时

### 4. 检查是否存在本站回链

脚本会同时抓：

- 页面 HTML 内容
- 页面所有 `a[href]` 链接

然后统一转成小写，检查其中是否包含：

- 本站域名
- 本站名称

当前配置里是：

```js
const SITE_INFO = {
  name: "fqzlr",
  url: "https://fqzlr.com/",
  avatar: "...",
  desc: "..."
};
```

于是脚本会重点寻找：

- `fqzlr.com`
- `fqzlr`

如果没找到，就说明“对方站点没有把你的友链真正挂上去”，申请不会通过。

---

## 第 8 步：失败时怎么处理

如果友链页打不开，或者没找到本站回链，脚本不会静默失败，而是自动在 Issue 里评论。

失败时会分成两类文案：

### 页面不可访问

会提示：

- 用户填写的友链页 URL
- 实际访问后的 URL
- HTTP 状态码
- 错误信息

### 页面可访问，但没找到本站友链

会提示：

- 没找到友链
- 请先在对方站点添加本站信息
- 附上本站名称、链接、头像、描述

同时还会给 Issue 打上：

```txt
needs-update
```

这样用户只要修完，再回评论，就能重新触发验证。

---

## 第 9 步：通过后如何写入 `friendsConfig.ts`

通过验证后，系统会进入“写配置”阶段。

这一步主要由三个函数完成：

- `parseFriendsConfig(content)`
- `renderFriend(friend, indent)`
- `updateFriendsConfig(repoRoot, data, issueId)`

### 为什么不是直接 `JSON.parse`

因为这个文件是 TypeScript，不是纯 JSON。

它长这样：

```ts
export const friendsConfig: FriendLink[] = [
  {
    title: "xxx",
    imgurl: "xxx",
    desc: "xxx",
    siteurl: "xxx",
    tags: ["Blog"],
    weight: 10,
    enabled: true,
    issue_id: 1,
  },
];
```

注意几点：

- 属性名没加引号
- 带类型标注
- 可能带注释
- 不是合法 JSON

所以脚本不能这样写：

```js
JSON.parse(match[1]);
```

这也是之前自动化里一个会继续引发报错的坑。

### 当前实现怎么做

现在的实现是：

1. 用正则先截出 `friendsConfig` 数组主体
2. 再把每个对象块拆出来
3. 分别抽取：
   - `title`
   - `imgurl`
   - `desc`
   - `siteurl`
   - `tags`
   - `weight`
   - `enabled`
   - `issue_id`
4. 构造成 JS 对象数组
5. 再渲染回 TypeScript 字面量

这是一种“结构感知但不依赖 TS AST”的轻量实现。

优点是简单、无额外编译依赖。  
缺点是如果你未来把 `friendsConfig.ts` 改成完全不同的格式，正则也得跟着改。

---

## 第 10 步：新增还是覆盖，怎么判断

脚本会根据 `siteurl` 判断这是不是已存在的友链：

```js
const existingIndex = friends.findIndex(
  (friend) => trimTrailingSlash(friend.siteurl) === normalizedUrl
);
```

这里做了去尾斜杠处理：

- `https://example.com`
- `https://example.com/`

会被视为同一个站点。

如果已存在：

- 覆盖旧项

如果不存在：

- push 新项

这样可以避免重复添加同一个网站。

---

## 第 11 步：为什么写完后还要再跑 Biome

这是这次修复里非常关键的一步。

自动脚本虽然能写出结构正确的 TS，但不一定和仓库的 Biome 格式完全一致。  
结果就是：

- 友链添加成功了
- 但 `biome ci ./src` 报 `File content differs from formatting output`

为了解决这个问题，我在脚本里加了一层：

```js
formatFriendsConfig(repoRoot);
```

它会调用仓库自己的 Biome 可执行文件：

```js
node_modules/.bin/biome
```

然后执行：

```bash
biome format --write src/config/friendsConfig.ts
```

这样自动生成的提交就会和仓库 CI 的格式要求一致。

这是把“写入成功”升级成“写入成功且能过 CI”的关键。

---

## 第 12 步：自动提交与推送

通过验证并写入配置后，脚本会自动执行 Git 流程：

```js
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add src/config/friendsConfig.ts
git commit -m "🤝 更新友链: 站点名"
git pull --rebase origin <default-branch>
git push origin HEAD:<default-branch>
```

这里有两个值得注意的点。

### 1. 为什么先 `pull --rebase`

因为仓库有可能在 workflow 运行期间又被其他人提交了新内容。  
如果直接 push，很容易出现：

```txt
! [rejected] master -> master (fetch first)
```

先 `pull --rebase` 可以降低这种失败概率。

### 2. 为什么不是强推

自动化流程里不应该默认 `--force`。  
因为它是服务流程，不是人工兜底流程。强推会增加误覆盖风险。

---

## 第 13 步：评论成功结果并关闭 Issue

自动提交成功后，脚本还会回到 GitHub 上收尾：

1. 评论“已成功添加友链”
2. 移除“验证中”
3. 移除 `needs-update`
4. 关闭 Issue

关闭时使用的是：

```js
await github.rest.issues.update({
  owner,
  repo,
  issue_number: issueNumber,
  state: "closed",
  state_reason: "completed"
});
```

这里要注意：

- `state` 必须是 `"closed"`
- 不能写成 `"completed"`

`completed` 是 `state_reason`，不是 `state`

这也是这次修复里顺手纠正的一个 API 用法问题。

---

## 五、这次真正需要改哪些代码

如果你也要照着搭一套，最少要改下面这些地方。

## 1. 修改 Issue 模板

文件：

```txt
.github/ISSUE_TEMPLATE/friend-request.yml
```

你要根据自己的站点信息调整：

- 模板标题
- 默认标签
- 表单字段
- “请先添加本站友链”的提示文案

如果你站点不是博客，还可以加更多字段，比如：

- RSS 链接
- 站点分类
- 站长昵称
- 是否接受头像热链

---

## 2. 修改站点常量

文件：

```txt
.github/scripts/process-friend-request.cjs
```

重点修改这里：

```js
const SITE_INFO = {
  name: "fqzlr",
  url: "https://fqzlr.com/",
  avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
  desc: "坐而言不如起而行."
};
```

这是整个校验逻辑里“本站信息”的唯一可信来源。

它会影响：

- 是否判断回链存在
- 失败时给用户展示的本站友链信息

---

## 3. 修改友链数据文件路径

如果你的友链配置不在当前路径，需要改这里：

```js
const FRIENDS_CONFIG_RELATIVE_PATH = "src/config/friendsConfig.ts";
```

如果你用的是：

- `friends.json`
- `data/friends.ts`
- `src/content/friends.yaml`

那解析和写入逻辑也要跟着改。

---

## 4. 修改配置文件字段映射

当前脚本写入的是这个结构：

```js
{
  title,
  imgurl,
  desc,
  siteurl,
  tags,
  weight,
  enabled,
  issue_id
}
```

如果你的项目使用的是别的字段，比如：

- `name`
- `url`
- `avatar`
- `description`

那就要同步调整：

- `parseFriendsConfig`
- `renderFriend`
- `updateFriendsConfig`

这三个函数。

---

## 5. 修改 Workflow 权限

当前 workflow 需要：

```yml
permissions:
  contents: write
  issues: write
```

原因是：

- `contents: write` 用来提交代码
- `issues: write` 用来评论、打标签、关闭 Issue

如果权限不够，会表现成：

- 能跑脚本
- 但不能回评
- 或者不能 push

---

## 6. 确保依赖安装方式和仓库一致

这次还修了一组很典型的 CI 坑。

### `pnpm/action-setup` 版本冲突

如果你的 `package.json` 已经有：

```json
"packageManager": "pnpm@9.14.4"
```

那么 workflow 里不要再写：

```yml
with:
  version: 9
```

否则会出现：

```txt
Multiple versions of pnpm specified
```

### Biome 命令找不到

不要依赖“全局有 biome 命令”。

更稳的方式是：

```yml
pnpm install --frozen-lockfile
pnpm exec biome ci ./src --reporter=github
```

这样 CI 使用的一定是仓库锁定的 Biome 版本。

---

## 六、为什么我把长逻辑挪出了 YAML

这是这次改动里最值得保留的一个经验。

一开始如果把全部逻辑都写在：

```yml
script: |
  ...
```

里面，会有这些真实问题：

1. 代码太长，维护困难
2. YAML 和 JS 的双层语法混在一起，调试痛苦
3. 混入 `#` 注释时会直接触发 `SyntaxError`
4. 编码、引号、缩进很容易造成“看起来没问题，运行就炸”

所以我最后采用的是：

- Workflow 里只保留短入口
- 真正逻辑写进 `.cjs` 文件

这也是我给所有 GitHub Actions 复杂逻辑的建议：

> YAML 负责调度，脚本文件负责业务。

不要让 YAML 同时承担“编排器”和“应用层代码容器”的职责。

---

## 七、这一套方案有哪些限制

这套实现已经够实用，但它不是没有边界。

## 1. `friendsConfig.ts` 解析依赖当前格式

现在是用正则和对象块拆分来处理 TS 配置。

所以如果你未来把友链配置改成：

- 嵌套更深
- 动态表达式更多
- 多行模板字符串
- 复杂注释结构

那解析函数需要一起升级。

更稳的长期方案有两个：

1. 改成单独的 JSON / YAML 数据文件
2. 用 TypeScript AST 或 Babel AST 解析

---

## 2. Playwright 校验是“近似真实浏览器”，但不是 100% 万能

比如：

- 站点有地区限制
- 站点会拦 GitHub Actions Runner IP
- 页面需要登录
- 友链列表要滚动或点击后才出现

这些情况下仍可能误判。

如果你的网站遇到这种场景，可以进一步增强：

- 增加自定义等待策略
- 支持指定 CSS 选择器
- 支持截图附件
- 把失败截图上传到 Issue 评论

---

## 3. 自动 push 依赖仓库分支策略

如果你的默认分支启用了非常严格的限制，比如：

- 不允许 GitHub Actions 写入
- 必须走 PR 合并
- 强制签名提交

那么脚本里的“直接提交并推送”就需要改造。

你可以改成：

1. 自动创建分支
2. 自动提交到新分支
3. 自动开 PR

这样会更适合协作型仓库。

---

## 八、如果你要从零搭建，推荐照这个顺序做

如果你不是在改现有项目，而是从零上手，我推荐按下面顺序来。

## 第 1 步：先确定友链数据存储格式

先决定你最终要写入哪里：

- JSON
- YAML
- TS 配置文件

这一步会直接决定后面脚本复杂度。

如果想最省事，我建议优先 JSON 或 YAML。  
如果你已经有成熟的 TS 配置结构，也可以像 Firefly 这样继续沿用。

---

## 第 2 步：先把 Issue 模板做好

不要一上来就写脚本。  
先确保用户提交的内容结构稳定。

因为自动化流程的第一输入，其实就是 Issue body。

---

## 第 3 步：先做“只解析不写入”

先写一个最小脚本，只做：

1. 读取 Issue 内容
2. 解析字段
3. 在日志里打印结果

这样先确认字段提取没问题，再往后接浏览器校验和写文件。

---

## 第 4 步：接入 Playwright 校验

等字段解析稳定后，再加：

- URL 检查
- 页面是否可访问
- 页面里是否包含本站回链

不要一开始把所有事情混在一块写，不然后期很难排错。

---

## 第 5 步：最后再接 Git 提交

真正危险的是自动提交阶段。  
我建议把“解析”和“校验”完全确认稳定后，再开放：

- 写文件
- git add
- git commit
- git push

否则一开始就自动 push，调试时很容易把仓库历史搞脏。

---

## 九、这次踩过的坑，顺手给你避掉

这里把这次实际遇到的问题总结一下。

## 1. `actions/github-script` 里的 JS 不是 Shell

`script: |` 里面只能写 JS，不能混进：

```txt
# 注释
```

这种 Shell 风格注释。  
否则会直接触发：

```txt
SyntaxError: Invalid or unexpected token
```

---

## 2. TS 配置文件不能直接 `JSON.parse`

`friendsConfig.ts` 是 TypeScript 对象字面量，不是 JSON。

只要你文件里有：

- 类型标注
- 非引号属性名
- 注释

它就不可能直接被 `JSON.parse`。

---

## 3. 自动写入后的文件必须再格式化

脚本“能写进去”不等于“能过 CI”。

格式化是必须的，不是锦上添花。

---

## 4. `pnpm/action-setup` 和 `packageManager` 不能双重声明版本

如果 `package.json` 已经写了：

```json
"packageManager": "pnpm@9.14.4"
```

workflow 里就不要重复写 `version`。

---

## 5. Cloudflare 机器人会检查 `wrangler.jsonc` 的 Worker 名称

如果你的项目名已经改成 `firefly`，但 `wrangler.jsonc` 里还是：

```json
"name": "fuwari"
```

Cloudflare 的机器人 PR 会持续提醒你更新。

所以这次也顺手把：

```json
"name": "fuwari"
```

改成了：

```json
"name": "firefly"
```

---

## 十、我对这套方案的建议

如果你只是个人博客，这套方案已经够用，而且很优雅：

- 没有数据库
- 没有后端服务
- 没有额外部署成本
- 审核门槛低
- 自动化程度高

它利用的其实都是 GitHub 现成能力：

- Issue Forms
- Actions
- `github-script`
- 仓库写权限

再加上一个 Playwright，就能拼出相当完整的业务闭环。

如果你以后还想继续增强，我建议优先加这几项：

1. 失败时自动截图并贴到评论
2. 自动创建 PR，而不是直接推默认分支
3. 将友链数据迁移到单独的 JSON / YAML 文件
4. 支持白名单域名 / 黑名单域名
5. 支持自动去重、自动排序、自动补充默认头像

---

## 十一、本文对应的关键文件清单

方便你对照仓库直接看：

- `.github/ISSUE_TEMPLATE/friend-request.yml`
- `.github/workflows/friend-link-checker.yml`
- `.github/scripts/process-friend-request.cjs`
- `src/config/friendsConfig.ts`
- `.github/workflows/biome.yml`
- `wrangler.jsonc`

---

## 十二、结语

这套“友链自助申请”方案本质上是把 GitHub 当成了一个轻量业务平台来用：

- 用 Issue 表单承接输入
- 用 Actions 承接流程
- 用脚本承接业务判断
- 用仓库文件承接数据落地

没有后端，也能把流程做完整。  
对个人博客和轻量站点来说，这种思路非常值。

如果你正在做自己的博客系统，或者想把原本人工处理的流程逐步自动化，我很推荐从这种“基于 Git 仓库自身能力”的方案开始搭。
