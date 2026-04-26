const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// -------------------------- 配置项（请修改为你的信息） --------------------------
const SITE_INFO = {
  name: "你的站点名称",
  url: "https://fqzlr.com",
  avatar: "https://fqzlr.com/avatar.jpg",
  desc: "你的站点描述"
};

const FRIENDS_CONFIG_PATH = path.join(__dirname, '../../src/config/friendsConfig.ts');
// -----------------------------------------------------------------------------

function parseIssueBody(body) {
  const data = {};
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '### 网站名称') {
      data.site_name = lines[i + 1]?.trim();
    } else if (line === '### 网站链接') {
      data.site_url = lines[i + 1]?.trim();
    } else if (line === '### 友链页面地址') {
      data.friend_page_url = lines[i + 1]?.trim();
    } else if (line === '### 网站描述') {
      data.site_desc = lines[i + 1]?.trim();
    } else if (line === '### 网站头像 URL') {
      data.site_avatar = lines[i + 1]?.trim() || '';
    } else if (line === '### 网站标签') {
      data.site_tag = lines[i + 1]?.trim() || 'Blog';
    }
  }
  return data;
}

async function validateFriendLink(pageUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(pageUrl, { timeout: 12000, waitUntil: 'domcontentloaded' });
    
    const result = await page.evaluate((site) => {
      const html = document.body.innerHTML;
      const hasUrl = html.includes(site.url) || 
                     html.includes(site.url.replace('https://', ''));
      const hasName = document.body.innerText.includes(site.name);
      return { hasUrl, hasName };
    }, SITE_INFO);

    await browser.close();
    
    if (!result.hasUrl && !result.hasName) {
      console.log('未在页面中找到本站链接或名称');
      return false;
    }
    return true;
  } catch (error) {
    await browser.close();
    console.error('页面访问失败:', error);
    return false;
  }
}

function escapeString(str) {
  return str.replace(/[\\"']/g, '\\$&').replace(/\n/g, '\\n');
}

function updateFriendsConfig(data, issueId) {
  let configContent = fs.readFileSync(FRIENDS_CONFIG_PATH, 'utf8');
  
  const avatar = data.site_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.site_name)}`;
  
  const newFriend = `  {
    title: "${escapeString(data.site_name)}",
    imgurl: "${avatar}",
    desc: "${escapeString(data.site_desc)}",
    siteurl: "${data.site_url}",
    tags: ["${data.site_tag}"],
    weight: 5,
    enabled: true,
    issue_id: ${issueId},
  },`;

  const match = configContent.match(/export const friendsConfig: FriendLink\[\] = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('无法找到 friendsConfig 数组定义');
  }
  
  const existingList = match[1];
  const updatedContent = configContent.replace(
    /export const friendsConfig: FriendLink\[\] = \[([\s\S]*?)\];/,
    `export const friendsConfig: FriendLink[] = [${existingList}${newFriend}\n];`
  );

  fs.writeFileSync(FRIENDS_CONFIG_PATH, updatedContent, 'utf8');
  console.log('✅ 友链配置已更新');
}

function isDuplicate(data) {
  const configContent = fs.readFileSync(FRIENDS_CONFIG_PATH, 'utf8');
  return configContent.includes(`siteurl: "${data.site_url}"`) ||
         configContent.includes(`title: "${data.site_name}"`);
}

async function main() {
  const issueId = process.env.ISSUE_ID;
  const issueBody = process.env.ISSUE_BODY;
  
  if (!issueBody) {
    console.error('❌ 未获取到 Issue 内容');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=failed\n`);
    return;
  }

  const formData = parseIssueBody(issueBody);
  console.log('📋 解析到的表单数据:', formData);

  if (!formData.site_name || !formData.site_url || !formData.friend_page_url || !formData.site_desc) {
    console.error('❌ 必填项缺失');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=failed\n`);
    return;
  }

  if (isDuplicate(formData)) {
    console.error('❌ 友链已存在');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=failed\n`);
    return;
  }

  console.log(`🔍 正在验证友链页面: ${formData.friend_page_url}`);
  const isValid = await validateFriendLink(formData.friend_page_url);
  
  if (!isValid) {
    console.error('❌ 友链验证失败：未在页面中找到本站链接');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=failed\n`);
    return;
  }

  console.log('📝 正在更新配置文件...');
  updateFriendsConfig(formData, issueId);

  console.log('✅ 所有步骤完成');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=success\n`);
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=failed\n`);
});