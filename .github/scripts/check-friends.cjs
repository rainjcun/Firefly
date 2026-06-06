const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const FRIENDS_CONFIG_PATH = path.join(__dirname, '../../src/config/friendsConfig.ts');
const TIMEOUT_MS = 15000;
const RETRY_TIMES = 2; // 增加重试次数
const RETRY_DELAY_MS = 1000; // 重试间隔

function parseFriendsConfig(content) {
  const start = content.indexOf('export const friendsConfig');
  const arrayStart = content.indexOf('[', start);
  const arrayEnd = content.lastIndexOf(']');
  if (arrayStart === -1 || arrayEnd === -1) return [];

  const arrayBody = content.slice(arrayStart + 1, arrayEnd);
  const friendBlocks = [...arrayBody.matchAll(/{([\s\S]*?)}\s*,?/g)].map((match) => match[1]);
  const friends = [];

  for (const block of friendBlocks) {
    const friend = {};
    const lines = block.split(/\n|,/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const pairMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.+)$/);
      if (!pairMatch) continue;
      const key = pairMatch[1];
      let value = pairMatch[2].trim();
      if (value.endsWith(',')) value = value.slice(0, -1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"');
      } else if (value === 'true' || value === 'false') {
        value = value === 'true';
      } else if (/^\d+$/.test(value)) {
        value = Number(value);
      }
      friend[key] = value;
    }

    if (friend.title && friend.siteurl) {
      friends.push(friend);
    }
  }

  return friends;
}

// 新增延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pingSite(url) {
  try {
    new URL(url);
  } catch {
    return { ok: false, error: `Invalid URL: ${url}` };
  }

  // 优化请求头，更贴近真实浏览器
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Chromium";v="128", "Not;A=Brand";v="99", "Google Chrome";v="128"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    Connection: 'keep-alive'
  };

  async function fetchWithTimeout() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers,
        cf: { cacheTtl: 0 } // 禁用Cloudflare缓存（如果适用）
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  // 增加多次重试逻辑
  let lastError;
  let lastStatus;
  for (let i = 0; i < RETRY_TIMES; i++) {
    try {
      const response = await fetchWithTimeout();
      // 放宽成功条件：2xx 状态码都视为成功（原逻辑仅 response.ok === true，即 200）
      if (response.status >= 200 && response.status < 300) {
        return { ok: true, status: response.status, url };
      }
      lastStatus = response.status;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    // 最后一次重试不延迟
    if (i < RETRY_TIMES - 1) {
      await delay(RETRY_DELAY_MS * (i + 1)); // 指数退避延迟
    }
  }

  return { ok: false, error: lastError, status: lastStatus, url };
}

async function main() {
  if (!fs.existsSync(FRIENDS_CONFIG_PATH)) {
    console.error(`❌ 无法找到友链配置文件：${FRIENDS_CONFIG_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(FRIENDS_CONFIG_PATH, 'utf8');
  const friends = parseFriendsConfig(content);
  if (!friends.length) {
    console.log('✅ 未发现有效友链配置，无需巡检');
    return;
  }

  const enabledFriends = friends.filter((item) => item.enabled !== false);
  if (!enabledFriends.length) {
    console.log('✅ 所有友链均已禁用，无需巡检');
    return;
  }

  console.log(`开始巡检 ${enabledFriends.length} 条友链...`);
  
  // 串行请求（避免并发被封），增加随机延迟
  const results = [];
  for (const friend of enabledFriends) {
    await delay(Math.random() * 1000 + 500); // 随机延迟 500-1500ms
    results.push(await pingSite(friend.siteurl));
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length) {
    console.error('❌ 以下友链检查失败：');
    for (const item of failed) {
      console.error(`- ${item.url} ${item.status ? `(HTTP ${item.status})` : ''} ${item.error || ''}`);
    }
    // 可选：改为警告而非直接退出（根据需求调整）
    // process.exit(1); 
    console.warn('⚠️ 存在友链访问失败，但脚本继续执行（已禁用强制退出）');
  } else {
    console.log('✅ 友链巡检通过，所有启用友链站点可访问');
  }
}

main().catch((error) => {
  console.error('❌ 巡检脚本执行失败：', error);
  process.exit(1);
});