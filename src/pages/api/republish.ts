// ============================================
// 转载文章 API 端点 (Cloudflare Worker 兼容版)
// ============================================
// 功能说明：
//   接收前端传来的文章链接，抓取网页内容并生成 Markdown，
//   将生成的 Markdown 内容返回给前端，由前端提供下载。
//
// 使用方法：
//   POST 请求到 /api/republish
//   请求体：{ "url": "https://example.com/article" }
//   返回：{ "success": true, "data": { title, author, markdown, fileName } }
//
// 依赖说明：
//   - cheerio: 用于解析 HTML 页面，提取标题、作者、正文等信息
//   - 注意：不再使用 fs/path，兼容 Cloudflare Workers 无文件系统环境
// ============================================

import type { APIContext } from "astro";
import * as cheerio from "cheerio";

// 禁用预渲染，此 API 必须在服务器端运行
export const prerender = false;

// POST 请求处理函数
export async function POST({ request }: APIContext) {
	try {
		// 1. 解析请求体，获取要转载的文章链接
		const body = await request.text();
		const data = JSON.parse(body || "{}");
		const targetUrl = data.url;

		if (!targetUrl) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "请提供要转载的文章链接",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// 2. 获取网页内容
		const response = await fetch(targetUrl, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		});

		if (!response.ok) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "无法访问该链接，请检查链接是否有效",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		// 3. 解析 HTML
		const html = await response.text();
		const $ = cheerio.load(html);

		// 4. 提取文章标题
		let title = $("h1").first().text().trim();
		if (!title) title = $("title").text().replace(/[-_|].*$/, "").trim();
		if (!title) title = "转载文章";

		// 5. 提取原作者信息
		let author = "";
		const authorSelectors = [
			'meta[name="author"]',
			'meta[property="article:author"]',
			'meta[property="og:article:author"]',
			".author",
			".article-author",
			".byline",
			'[rel="author"]',
		];
		for (const selector of authorSelectors) {
			const element = $(selector);
			if (element.length > 0) {
				author = element.attr("content") || element.text().trim();
				if (author) break;
			}
		}
		if (!author) author = "未知作者";

		// 6. 提取文章描述
		const description =
			$('meta[name="description"]').attr("content") ||
			$('meta[property="og:description"]').attr("content") ||
			$("p").first().text().substring(0, 150).trim();

		// 7. 提取文章正文内容
		let content = "";
		const contentSelectors = [
			".article-content",
			".post-content",
			".entry-content",
			".content",
			".main-content",
			'[role="main"]',
			"article",
			"#content",
			".post-body",
		];
		let foundContent = false;
		for (const selector of contentSelectors) {
			const element = $(selector);
			if (element.length > 0 && element.text().length > 100) {
				content = element.html() || "";
				foundContent = true;
				break;
			}
		}

		if (!foundContent) {
			const bodyContent =
				$("body")
					.not("script")
					.not("style")
					.not("header")
					.not("footer")
					.not("nav")
					.html() || "";
			content = bodyContent;
		}

		// 8. 清理内容
		const contentCleaned = content
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
			.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
			.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
			.replace(/<form[^>]*>[\s\S]*?<\/form>/gi, "")
			.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "")
			.replace(/<!--[\s\S]*?-->/g, "")
			.replace(/\s+/g, " ")
			.trim();

		// 9. 生成文件名和日期
		const dateStr = new Date().toISOString().split("T")[0];
		const slug =
			title
				.toLowerCase()
				.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
				.replace(/-+/g, "-")
				.replace(/^-|-$/g, "") || `republish-${Date.now()}`;

		// 10. 构建 Markdown 内容
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

		// 11. 返回生成的 Markdown 内容（不再写入文件系统）
		return new Response(
			JSON.stringify({
				success: true,
				message: "转载内容已生成！请下载 Markdown 文件并保存到项目的 src/content/posts/republish/ 目录中。",
				data: {
					title,
					author,
					slug,
					fileName: `${slug}.md`,
					markdown: markdownContent,
				},
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		console.error("Republish error:", error);
		return new Response(
			JSON.stringify({
				success: false,
				message: "转载失败，请稍后重试",
				error: error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
