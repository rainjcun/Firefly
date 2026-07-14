import fs from 'fs';
import path from 'path';

const postsDir = path.join(path.dirname(import.meta.url).replace('file:///', ''), '..', 'src', 'content', 'posts');
const targetDir = path.join(postsDir, 'republish', 'FQ');

const keepFiles = [
  'example-domain.md',
  'tutorials.md',
  '模块-4-1-现代前端第一步-模块化.md'
];

function isKeepFile(filePath) {
  const fileName = path.basename(filePath);
  return keepFiles.includes(fileName);
}

function addRepublishTag(content, fileName) {
  const lines = content.split('\n');
  const frontmatterStart = lines.findIndex(line => line.trim() === '---');
  
  if (frontmatterStart === -1) {
    const newContent = `---
title: "${fileName.replace(/\.[^/.]+$/, '')}"
published: ${new Date().toISOString().split('T')[0]}
description: ""
tags: ["转载"]
category: "转载"
draft: false
originalUrl: ""
originalAuthor: "原作者"
---

${content}`;
    return newContent;
  }
  
  const frontmatterEnd = lines.slice(frontmatterStart + 1).findIndex(line => line.trim() === '---');
  if (frontmatterEnd === -1) {
    return content;
  }
  
  const endIndex = frontmatterStart + 1 + frontmatterEnd;
  const frontmatter = lines.slice(frontmatterStart + 1, endIndex);
  const body = lines.slice(endIndex + 1);
  
  let hasTags = false;
  let hasCategory = false;
  let hasOriginalUrl = false;
  let hasOriginalAuthor = false;
  
  const newFrontmatter = frontmatter.map(line => {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('tags:')) {
      hasTags = true;
      const match = trimmed.match(/tags:\s*\[([^\]]*)\]/);
      if (match) {
        const tags = match[1];
        if (!tags.includes('"转载"') && !tags.includes("'转载'")) {
          return `tags: ["转载", ${tags}]`;
        }
      }
    }
    
    if (trimmed.startsWith('category:')) {
      hasCategory = true;
      return 'category: "转载"';
    }
    
    if (trimmed.startsWith('originalUrl:')) {
      hasOriginalUrl = true;
    }
    
    if (trimmed.startsWith('originalAuthor:')) {
      hasOriginalAuthor = true;
    }
    
    return line;
  });
  
  if (!hasTags) {
    newFrontmatter.push('tags: ["转载"]');
  }
  
  if (!hasCategory) {
    newFrontmatter.push('category: "转载"');
  }
  
  if (!hasOriginalUrl) {
    newFrontmatter.push('originalUrl: ""');
  }
  
  if (!hasOriginalAuthor) {
    newFrontmatter.push('originalAuthor: "原作者"');
  }
  
  return `---\n${newFrontmatter.join('\n')}\n---\n${body.join('\n')}`;
}

function processDirectory(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  entries.forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (entry.name === 'republish') {
        return;
      }
      processDirectory(fullPath, prefix + entry.name + '/');
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      if (isKeepFile(fullPath)) {
        console.log(`保留: ${fullPath}`);
        return;
      }
      
      console.log(`处理: ${fullPath}`);
      
      const content = fs.readFileSync(fullPath, 'utf-8');
      const newContent = addRepublishTag(content, entry.name);
      
      const targetPath = path.join(targetDir, prefix + entry.name);
      const targetDirPath = path.dirname(targetPath);
      
      if (!fs.existsSync(targetDirPath)) {
        fs.mkdirSync(targetDirPath, { recursive: true });
      }
      
      fs.writeFileSync(targetPath, newContent, 'utf-8');
      fs.unlinkSync(fullPath);
      
      console.log(`→ 移动到: ${targetPath}`);
    }
  });
  
  if (dir !== postsDir && dir !== path.join(postsDir, 'republish')) {
    try {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmdirSync(dir);
        console.log(`删除空目录: ${dir}`);
      }
    } catch (e) {
      console.log(`跳过目录: ${dir}`);
    }
  }
}

console.log('开始移动文章到转载目录...\n');
processDirectory(postsDir);
console.log('\n完成！');
