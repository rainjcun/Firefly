const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

// -------------------------- 配置项（请替换为你的真实信息） --------------------------
const SITE_INFO = {
  name: "fqzlr",
  url: "https://fqzlr.com/",
  avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
  desc: "坐而言不如起而行."
};

const FRIENDS_CONFIG_PATH = path.join(__dirname, '../../src/config/friendsConfig.ts');
const DEFAULT_TAG = 'Blog';
// -----------------------------------------------------------------------------

function normalizeUrl(value) {
  try {
    return new URL(value.trim()).toString();
  } catch {
    return '';
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseIssueBody(body) {
  const data = {
    site_name: '',
    site_url: '',
    friend_page_url: '',
    site_desc: '',
    site_avatar: '',
    site_tag: DEFAULT_TAG
  };

  const lines = body.split(/\r?\n/).map((line) => line.trim());
  let pendingField = null;

  const assignField = (field, value) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    switch (field) {
      case 'site_name':
        data.site_name = trimmed;
        break;
      case 'site_url':
        data.site_url = normalizeUrl(trimmed);
        break;
      case 'friend_page_url':
        data.friend_page_url = normalizeUrl(trimmed);
        break;
      case 'site_desc':
        data.site_desc = trimmed;
        break;
      case 'site_avatar':
        data.site_avatar = normalizeUrl(trimmed);
        break;
      case 'site_tag':
        data.site_tag = trimmed || DEFAULT_TAG;
        break;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;

    if (/^#+\s*(网站名称|名称|站点名称)/.test(line)) {
      pendingField = 'site_name';
      continue;
    }
    if (/^#+\s*(网站链接|站点链接|链接|网址|地址)/.test(line)) {
      pendingField = 'site_url';
      continue;
    }
    if (/^#+\s*(友链页面|友链地址)/.test(line)) {
      pendingField = 'friend_page_url';
      continue;
    }
    if (/^#+\s*(网站描述|描述|简介)/.test(line)) {
      pendingField = 'site_desc';
      continue;
    }
    if (/^#+\s*(网站头像|头像|图标)/.test(line)) {
      pendingField = 'site_avatar';
      continue;
    }
    if (/^#+\s*(网站标签|标签|分类)/.test(line)) {
      pendingField = 'site_tag';
      continue;
    }

    if (pendingField) {
      assignField(pendingField, line);
      pendingField = null;
      continue;
    }

    if (/[:：]/.test(line)) {
      const [key, ...rest] = line.split(/[:：]/);
      const value = rest.join('').trim();
      if (!value) continue;

      if (/名称|标题/.test(key)) assignField('site_name', value);
      else if (/网站链接|站点链接|链接|网址|地址/.test(key)) assignField('site_url', value);
      else if (/友链页面|友链地址/.test(key)) assignField('friend_page_url', value);
      else if (/描述|简介/.test(key)) assignField('site_desc', value);
      else if (/头像|图标/.test(key)) assignField('site_avatar', value);
      else if (/标签|分类/.test(key)) assignField('site_tag', value);
    }
  }

  console.log('📋 解析结果：', data);
  return data;
}

function hasDuplicateSite(configContent, url) {
  if (!url) return false;
  const escaped = escapeRegExp(url);
  const siteurlRegex = new RegExp(`siteurl:\\s*['"]${escaped}['"]`, 'i');
  return siteurlRegex.test(configContent);
}

async function validateFriendLink(pageUrl) {
  if (!pageUrl) {
    console.error('❌ 友链页面地址为空');
    return false;
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    await page.goto(pageUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });
    const hasLink = await page.evaluate((site) => {
      return document.body.innerText.includes(site.name) || document.body.innerHTML.includes(site.url);
    }, SITE_INFO);

    await browser.close();
    return hasLink;
  } catch (error) {
    await browser.close();
    console.error('页面访问失败:', error.message || error);
    return false;
  }
}

function buildFriendConfigEntry(data, issueId) {
  const avatar = data.site_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.site_name)}`;
  const tag = data.site_tag || DEFAULT_TAG;
  return `	{
		title: "${data.site_name}",
		imgurl: "${avatar}",
		desc: "${data.site_desc}",
		siteurl: "${data.site_url}",
		tags: ["${tag}"],
		weight: 5,
		enabled: true,
		issue_id: ${issueId || 0},
	},\n`;
}

function updateFriendsConfig(data, issueId) {
  const configContent = fs.readFileSync(FRIENDS_CONFIG_PATH, 'utf8');
  if (hasDuplicateSite(configContent, data.site_url)) {
    console.error('❌ 该站点已存在于 friendsConfig.ts，避免重复添加');
    return false;
  }

  const entry = buildFriendConfigEntry(data, issueId);
  const regex = /export const friendsConfig: FriendLink\[\] = \[([\s\S]*?)\n\];/;

  if (!regex.test(configContent)) {
    console.error('❌ 无法解析 friendsConfig.ts，请检查文件结构是否正确');
    return false;
  }

  const updatedContent = configContent.replace(regex, (_match, list) => {
    return `export const friendsConfig: FriendLink[] = [${list}${entry}];`;
  });

  fs.writeFileSync(FRIENDS_CONFIG_PATH, updatedContent, 'utf8');
  console.log('✅ 友链配置已更新');
  return true;
}

async function main() {
  const issueId = Number(process.env.ISSUE_ID || 0);
  const issueBody = process.env.GITHUB_EVENT_ISSUE_BODY || '';

  if (!issueBody) {
    console.error('❌ 未获取到 Issue 内容');
    process.exit(1);
  }

  const formData = parseIssueBody(issueBody);
  if (!formData.site_name || !formData.site_url || !formData.friend_page_url) {
    console.error('❌ 表单信息不完整，请确保填写名称、链接和友链页面地址');
    process.exit(1);
  }

  if (!normalizeUrl(formData.site_url) || !normalizeUrl(formData.friend_page_url)) {
    console.error('❌ 站点链接或友链页面地址不是有效 URL');
    process.exit(1);
  }

  const valid = await validateFriendLink(formData.friend_page_url);
  if (!valid) {
    console.error('❌ 友链验证失败，未在目标页面中找到本站信息');
    process.exit(1);
  }

  const success = updateFriendsConfig(formData, issueId);
  if (!success) process.exit(1);

  console.log('✅ 友链申请已成功写入 friendsConfig.ts');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});