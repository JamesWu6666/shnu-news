export const NEWS_SOURCES = {
  jwc: {
    name: '教务处',
    baseUrl: 'https://jwc.shnu.edu.cn',
    categories: [
      { name: '学生公告', url: '/17118/list.htm', selector: 'table tr a[href*="page.htm"]' },
      { name: '大创通知', url: '/17003/list.htm', selector: 'table tr a[href*="page.htm"]' },
      { name: '学科竞赛', url: '/17030/list.htm', selector: 'table tr a[href*="page.htm"]' },
    ]
  }
};

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 加载 .env 文件
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
}

export const QWEN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
export const QWEN_API_KEY = process.env.QWEN_API_KEY || '';
export const DATA_FILE = './data/news-data.json';
export const SETTINGS_FILE = './data/settings.json';
