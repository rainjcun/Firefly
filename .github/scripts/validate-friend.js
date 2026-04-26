const { chromium } = require('node:playwright');
const fs = require('node:fs');
const path = require('node:path');

// -------------------------- 配置项（请修改为你的信息） --------------------------
const SITE_INFO = {
  name: "夏夜流萤",
  url: "https://blog.cuteleaf.cn",
  avatar: "https://q1.qlogo.cn/g?b=qq&nk=7618557&s=640",
  desc: "一个博客站点"
};

const FRIENDS_CONFIG_PATH = path.join(__dirname, '../../src/config/friendsConfig.ts');
// -----------------------------------------------------------------------------

// 从 Issue 中提取表单数据
function parseIssueBody(body) {
  const data = {};
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### 网站名称')) {
      data.site_name = lines[i + 1]?.trim();
    } else if (line.startsWith('### 网站链接')) {
      data.site_url = lines[i + 1]?.trim();
    } else if (line.startsWith('### 友链页面地址')) {
      data.friend_page_url = lines[i + 1]?.trim();
    } else if (line.startsWith('### 网站描述')) {
      data.site_desc = lines[i + 1]?.trim();
    } else if (line.startsWith('### 网站头像 URL')) {
      data.site_avatar = lines[i + 1]?.trim() || '';
    } else if (line.startsWith('### 网站标签')) {
      data.site_tag = lines[i + 1]?.trim() || 'Blog';
    }
  }
  return data;
}

// 验证友链页面是否包含本站信息
async function validateFriendLink(pageUrl) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(pageUrl, { timeout: 12000, waitUntil: 'domcontentloaded' });

    const hasLink = await page.evaluate((site) => {
      return document.body.innerText.includes(site.name) ||
             document.body.innerHTML.includes(site.url);
    }, SITE_INFO);

    await browser.close();
    return hasLink;
  } catch (error) {
    await browser.close();
    console.error('页面访问失败:', error);
    return false;
  }
}

// 更新 friendsConfig.ts 文件
function updateFriendsConfig(data, issueId) {
  const configContent = fs.readFileSync(FRIENDS_CONFIG_PATH, 'utf8');

  const newFriend = `  {
    title: "${data.site_name}",
    imgurl: "${data.site_avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(data.site_name)}`}",
    desc: "${data.site_desc}",
    siteurl: "${data.site_url}",
    tags: ["${data.site_tag}"],
    weight: 5,
    enabled: true,
    issue_id: ${issueId},
  },`;

  const updatedContent = configContent.replace(
    /export const friendsConfig: FriendLink\[\] = \[([\s\S]*?)\];/,
    (_match, list) => {
      return `export const friendsConfig: FriendLink[] = [${list}${newFriend}\n];`;
    }
  );

  fs.writeFileSync(FRIENDS_CONFIG_PATH, updatedContent, 'utf8');
  console.log('✅ 友链配置已更新');
}

// 主函数
async function main() {
  const issueId = process.env.ISSUE_ID;
  const issueBody = process.env.GITHUB_EVENT_ISSUE_BODY;

  if (!issueBody) {
    console.error('❌ 未获取到 Issue 内容');
    process.stdout.write('::set-output name=status::failed\n');
    return;
  }

  const formData = parseIssueBody(issueBody);
  console.log('📋 解析到的表单数据:', formData);

  const isValid = await validateFriendLink(formData.friend_page_url);
  if (!isValid) {
    console.error('❌ 友链验证失败');
    process.stdout.write('::set-output name=status::failed\n');
    return;
  }

  updateFriendsConfig(formData, issueId);

  process.stdout.write('::set-output name=status::success\n');
}

main().catch(err => {
  console.error('❌ 脚本执行失败:', err);
  process.stdout.write('::set-output name=status::failed\n');
});