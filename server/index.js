import express from 'express';
import cors from 'cors';
import { fetchAll, searchOfficial } from './fetcher.js';
import { mergeNews, getNews, getRecentNews, loadNews, loadSettings, saveSettings, loadPushCondition, savePushCondition, loadBookmarks, saveBookmarks } from './store.js';
import { filterNews, summarizeNews, aiSearch } from './qwen.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 获取所有新闻
app.get('/api/news', (req, res) => {
  try {
    const filter = req.query.source || req.query.category ? {
      source: req.query.source,
      category: req.query.category
    } : undefined;
    const news = getNews(filter);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取新闻元信息（最后刷新时间等）
app.get('/api/news/meta', (req, res) => {
  try {
    const data = loadNews();
    res.json({ lastFetchTime: data.lastFetchTime || '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取最近新闻（三天内）
app.get('/api/news/recent', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const news = getRecentNews(days);
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 触发抓取
app.post('/api/news/fetch', async (req, res) => {
  try {
    const news = await fetchAll();
    const newItems = mergeNews(news);
    res.json({
      success: true,
      newCount: newItems.length,
      totalCount: getNews().length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI筛选
app.post('/api/news/filter', async (req, res) => {
  try {
    const { news, prompt } = req.body;
    if (!news || !prompt) {
      return res.status(400).json({ error: '缺少参数' });
    }
    const ids = await filterNews(news, prompt);
    res.json(ids);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 搜索官方
app.post('/api/news/search', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: '缺少关键词' });
    }
    const results = await searchOfficial(keyword);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI搜索
app.post('/api/news/ai-search', async (req, res) => {
  try {
    const { keyword } = req.body;
    if (!keyword) {
      return res.status(400).json({ error: '缺少关键词' });
    }

    // 先搜索官网
    const searchResults = await searchOfficial(keyword);

    // AI分析筛选
    const results = await aiSearch(keyword, searchResults);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取设置
app.get('/api/settings', (req, res) => {
  try {
    const settings = loadSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存设置
app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    saveSettings(settings);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取推送条件
app.get('/api/push/condition', (req, res) => {
  try {
    const condition = loadPushCondition();
    res.json(condition);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存推送条件
app.post('/api/push/condition', (req, res) => {
  try {
    const { condition } = req.body;
    savePushCondition(condition);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取收藏
app.get('/api/bookmarks', (req, res) => {
  try {
    const bookmarks = loadBookmarks();
    res.json(bookmarks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存收藏（完整替换）
app.post('/api/bookmarks', (req, res) => {
  try {
    const bookmarks = req.body;
    if (!Array.isArray(bookmarks)) {
      return res.status(400).json({ error: '收藏格式错误' });
    }
    saveBookmarks(bookmarks);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加单条收藏
app.post('/api/bookmarks/add', (req, res) => {
  try {
    const { title, url, remark } = req.body;
    if (!title || !url) {
      return res.status(400).json({ error: '缺少标题或链接' });
    }
    const bookmarks = loadBookmarks();
    // 检查是否已存在
    if (!bookmarks.some(b => b.url === url)) {
      bookmarks.push({ title, url, remark: remark || '' });
      saveBookmarks(bookmarks);
    }
    res.json({ success: true, bookmarks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新收藏备注
app.post('/api/bookmarks/update', (req, res) => {
  try {
    const { url, remark } = req.body;
    if (!url) {
      return res.status(400).json({ error: '缺少链接' });
    }
    const bookmarks = loadBookmarks();
    const index = bookmarks.findIndex(b => b.url === url);
    if (index !== -1) {
      bookmarks[index].remark = remark || '';
      saveBookmarks(bookmarks);
    }
    res.json({ success: true, bookmarks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除单条收藏
app.delete('/api/bookmarks', (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: '缺少链接' });
    }
    let bookmarks = loadBookmarks();
    bookmarks = bookmarks.filter(b => b.url !== url);
    saveBookmarks(bookmarks);
    res.json({ success: true, bookmarks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI生成摘要
app.post('/api/news/summarize', async (req, res) => {
  try {
    const { news } = req.body;
    if (!news || !Array.isArray(news)) {
      return res.status(400).json({ error: '缺少新闻参数' });
    }

    // 流式传输：设置 chunked transfer encoding
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const result = await summarizeNews(news);
    res.write(JSON.stringify(result));
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
