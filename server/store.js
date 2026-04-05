import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DATA_FILE, SETTINGS_FILE } from './constant.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureDataDir() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

function getDataPath(filename) {
  return path.join(ensureDataDir(), filename);
}

export function loadNews() {
  const dataPath = getDataPath('news-data.json');
  if (fs.existsSync(dataPath)) {
    try {
      const data = fs.readFileSync(dataPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error loading news:', e);
    }
  }
  return { news: [], lastFetchTime: '' };
}

export function saveNews(data) {
  const dataPath = getDataPath('news-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

export function loadSettings() {
  const settingsPath = getDataPath('settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
  return {
    fetchDays: 3,
    notifications: true
  };
}

export function saveSettings(settings) {
  const settingsPath = getDataPath('settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function mergeNews(newNews) {
  const data = loadNews();
  const existingIds = new Set(data.news.map(n => n.id));
  const newItems = newNews.filter(n => !existingIds.has(n.id));

  data.news = [...newItems, ...data.news].slice(0, 1000);
  data.lastFetchTime = new Date().toISOString();

  saveNews(data);
  return newItems;
}

export function getNews(filter) {
  const data = loadNews();
  let result = data.news;

  if (filter?.source) {
    result = result.filter(n => n.source === filter.source);
  }
  if (filter?.category) {
    result = result.filter(n => n.category === filter.category);
  }

  return result;
}

export function getRecentNews(days = 3) {
  const data = loadNews();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  return data.news.filter(n => n.date >= cutoffStr);
}

export function loadPushCondition() {
  const conditionPath = getDataPath('push-condition.json');
  if (fs.existsSync(conditionPath)) {
    try {
      const data = fs.readFileSync(conditionPath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error loading push condition:', e);
    }
  }
  return { condition: '' };
}

export function savePushCondition(condition) {
  const conditionPath = getDataPath('push-condition.json');
  fs.writeFileSync(conditionPath, JSON.stringify({ condition }, null, 2));
}

export function loadBookmarks() {
  const path = getDataPath('bookmarks.json');
  if (fs.existsSync(path)) {
    try {
      const data = fs.readFileSync(path, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error loading bookmarks:', e);
    }
  }
  return [];
}

export function saveBookmarks(bookmarks) {
  const path = getDataPath('bookmarks.json');
  fs.writeFileSync(path, JSON.stringify(bookmarks, null, 2));
}
