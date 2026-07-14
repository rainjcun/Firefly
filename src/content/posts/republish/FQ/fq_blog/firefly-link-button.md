---
title: Firefly 友链自助申请按钮添加
published: 2026-04-27
updated: 2026-04-27
description: 一步到位给 Firefly 主题添加两种友链自助申请入口：右上角申请按钮 + 友链页面文字超链接，复制即用。
tags:
  - Firefly
  - 友链
  - 自助申请
  - Astro
  - 博客优化
category: "转载"
draft: false
author: fqzlr
originalUrl: ""
originalAuthor: "原作者"
---

# Firefly 友链自助申请按钮添加

本篇教程适用于 **Firefly Astro 主题**，不破坏原有布局、不影响任何功能，只修改两处代码，实现两种友链申请入口。

- 右上角「自助申请友链」按钮
- 友链页面内「自助申请友链」文字链接

## 一、准备工作

1. 打开你的 Firefly 项目
2. 准备好你的 GitHub 友链申请地址
```
https://github.com/fqzlr/Firefly/issues/new?template=friend-request.yml
```

全程只需要修改 **2 个文件**，复制粘贴即可完成。

---

## 二、添加右上角「自助申请友链」按钮

### 修改文件
```
src/pages/friends.astro
```

### 步骤 1：添加申请链接
在文件顶部的变量区域加入：

```astro
const friendApplyUrl = "https://github.com/fqzlr/Firefly/issues/new?template=friend-request.yml";
```

### 步骤 2：替换标题区域布局
找到页面标题部分，替换成以下布局：

```astro
<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
  <div>
    <div class="flex items-center gap-3 mb-3">
      <div class="h-8 w-8 rounded-lg bg-(--primary) flex items-center justify-center text-white">
        <Icon name="material-symbols:group" class="text-[1.5rem]" />
      </div>
      <div class="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        {title}
      </div>
    </div>
    {description && (
      <p class="text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
        {description}
      </p>
    )}
  </div>

  <!-- 自助申请友链按钮 -->
  <div class="flex shrink-0 flex-col items-start gap-2 md:items-end">
    <a
      href={friendApplyUrl}
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-2 rounded-lg bg-(--primary) px-4 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
    >
      <Icon name="material-symbols:add-link-rounded" class="text-lg" />
      <span>自助申请友链</span>
    </a>
    <p class="text-xs text-neutral-500 dark:text-neutral-400 md:text-right">
      通过 GitHub Issue 提交，系统会自动校验回链并同步收录
    </p>
  </div>
</div>
```

### 完成效果
✅ 右上角出现美观的申请按钮  
✅ 适配明暗主题  
✅ 点击直接跳转到友链申请表单  
✅ 不破坏任何原有布局

---

## 三、添加友链页面内文字超链接

### 修改文件
```
src/content/spec/friends.mdx
```

找到 Step 2 里的：

```html
<p class="font-semibold text-sm mb-1">自助申请友链</p>
```

替换成 **文字超链接样式**：

```astro
<a href="https://github.com/fqzlr/Firefly/issues/new?template=friend-request.yml" 
   target="_blank"
   class="font-semibold text-sm mb-1 inline-block text-(--primary) hover:underline">
  自助申请友链
</a>
```

### 完成效果
✅ 保持布局完全不变  
✅ 文字变为主题色超链接  
✅ 鼠标悬浮自动加下划线  
✅ 点击即可跳转申请

---

## 四、最终效果

你的友链页面现在拥有：

1. **右上角申请按钮**（醒目、直观）
2. **步骤中的文字链接**（流程清晰、体验友好）

两者配合，访客可以非常方便地提交友链申请。

---

## 五、常见问题

### 1. 按钮文字看不见
这是 CSS 变量问题，可使用固定色值：
```astro
class="... bg-blue-500 text-white ..."
```

### 2. 跳转 404
检查用户名、仓库名、yml 模板文件名是否正确。

### 3. 样式错位
只替换教程里对应的代码块，不要改动其他结构。

---

## 六、总结

只需修改 2 个文件：
- `src/pages/friends.astro` → 右上角按钮
- `src/content/spec/friends.mdx` → 文字链接


