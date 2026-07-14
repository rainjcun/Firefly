// ============================================
// 转载文章 API 端点
// ============================================
// 功能说明：
//   这是一个后端 API，接收前端传来的文章链接，
//   自动抓取网页内容并在本地生成 Markdown 文件。
// 
// 使用方法：
//   POST 请求到 /api/republish
//   请求体：{ "url": "https://example.com/article" }
//   返回：{ "success": true, "data": {...} }
// 
// 依赖说明：
//   - cheerio: 用于解析 HTML 页面，提取标题、作者、正文等信息
//   - fs: Node.js 文件系统，用于写入 .md 文件
//   - path: Node.js 路径处理，用于构建文件路径
// ============================================

import type { APIContext } from 'astro';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// 关键配置：禁用预渲染，必须在服务器端运行
// ============================================
// Astro 默认会预渲染所有页面为静态文件，但 API 需要在运行时执行
// 所以必须设置 prerender = false
export const prerender = false;

// POST 请求处理函数
// Astro 框架会自动将 /api/republish 的 POST 请求路由到这里
export async function POST({ request }: APIContext) {
  try {
    // 1. 解析请求体，获取要转载的文章链接
    // 使用 text() 先读取原始内容，再手动解析 JSON，避免解析错误
    const body = await request.text();
    const data = JSON.parse(body || '{}');
    const targetUrl = data.url;
    
    // 检查链接是否为空
    if (!targetUrl) {
      return new Response(JSON.stringify({
        success: false,
        message: '请提供要转载的文章链接'
      }), { status: 400 });
    }

    // 2. 使用 fetch 获取网页内容
    // 设置 User-Agent 模拟浏览器，避免被目标网站拦截
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // 检查请求是否成功
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        message: '无法访问该链接，请检查链接是否有效'
      }), { status: 400 });
    }

    // 3. 使用 cheerio 解析 HTML
    const html = await response.text();
    const $ = cheerio.load(html);  // $ 就像 jQuery 的选择器

    // 4. 提取文章标题
    // 优先从 h1 标签获取，其次从 title 标签获取
    let title = $('h1').first().text().trim();
    if (!title) title = $('title').text().replace(/[-_|].*$/, '').trim();
    if (!title) title = '转载文章';  // 默认标题

    // 5. 提取原作者信息
    // 尝试多种常见的作者选择器
    let author = '';
    const authorSelectors = [
      'meta[name="author"]',           // HTML meta 标签
      'meta[property="article:author"]', // Open Graph 协议
      'meta[property="og:article:author"]', // Open Graph 协议
      '.author',                       // 常见的作者类名
      '.article-author',               // 常见的作者类名
      '.byline',                       // 常见的作者类名
      '[rel="author"]'                 // 链接关系属性
    ];
    for (const selector of authorSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        author = element.attr('content') || element.text().trim();
        if (author) break;
      }
    }
    if (!author) author = '未知作者';  // 默认作者

    // 6. 提取文章描述
    // 从 meta description 或 og:description 获取
    let description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || 
                      $('p').first().text().substring(0, 150).trim();

    // 7. 提取文章正文内容
    // 尝试多种常见的内容选择器
    let content = '';
    const contentSelectors = [
      '.article-content',  // 常见的内容容器类名
      '.post-content',     // 常见的内容容器类名
      '.entry-content',    // WordPress 常用类名
      '.content',          // 通用类名
      '.main-content',     // 主内容区
      '[role="main"]',     // ARIA 角色
      'article',           // HTML5 article 标签
      '#content',          // 内容区域 ID
      '.post-body'         // 文章正文类名
    ];
    let foundContent = false;
    for (const selector of contentSelectors) {
      const element = $(selector);
      // 只选取内容长度超过 100 字符的元素，避免误选
      if (element.length > 0 && element.text().length > 100) {
        content = element.html() || '';
        foundContent = true;
        break;
      }
    }
    
    // 如果以上选择器都没找到，就从 body 中提取（排除脚本、样式、导航等）
    if (!foundContent) {
      const bodyContent = $('body').not('script').not('style').not('header').not('footer').not('nav').html() || '';
      content = bodyContent;
    }

    // 8. 清理内容，移除不需要的标签
    const contentCleaned = content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // 移除脚本
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // 移除样式
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')  // 移除 iframe
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '') // 移除 noscript
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')      // 移除表单
      .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')        // 移除 SVG
      .replace(/<!--[\s\S]*?-->/g, '')                    // 移除注释
      .replace(/\s+/g, ' ')                               // 合并多余空格
      .trim();

    // 9. 生成文件名和日期
    const dateStr = new Date().toISOString().split('T')[0];  // 当前日期
    // 将标题转换为文件名（去掉特殊字符，用连字符连接）
    const slug = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `republish-${Date.now()}`;
    
    // 10. 构建 Markdown 内容
    // 包含 frontmatter（文章元数据）和正文内容
    const markdownContent = `---
title: "${title}"
published: ${dateStr}
description: "${description.substring(0, 200)}"
tags: ["转载"]
category: "转载"
draft: false
originalUrl: "${targetUrl}"
originalAuthor: "${author}"
---

> **原作者**: ${author}
> **原文链接**: [${targetUrl}](${targetUrl})

---

${contentCleaned}`;

    // 11. 写入文件
    const postsDir = path.join(process.cwd(), 'src', 'content', 'posts', 'republish');
    const fileName = `${slug}.md`;
    const filePath = path.join(postsDir, fileName);

    fs.writeFileSync(filePath, markdownContent, 'utf-8');

    // 12. 返回成功响应
    return new Response(JSON.stringify({
      success: true,
      message: '转载成功！文章已自动生成',
      data: {
        title,
        author,
        filePath: `src/content/posts/republish/${fileName}`,
        url: `/posts/republish/${slug}/`
      }
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    // 捕获并返回错误信息
    console.error('Republish error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: '转载失败，请稍后重试',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { status: 500 });
  }
}
