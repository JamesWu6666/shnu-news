import axios from 'axios';
import * as cheerio from 'cheerio';
import { NEWS_SOURCES } from './constant.js';

function generateId(title, url) {
  // 使用标题+URL的组合来生成唯一ID
  const combined = `${title}|${url}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function parseDate(dateStr) {
  const match = dateStr.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : new Date().toISOString().split('T')[0];
}

function resolveUrl(url, source) {
  if (url.startsWith('http')) return url;
  const base = NEWS_SOURCES[source]?.baseUrl || '';
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchCategory(source, categoryName, categoryUrl, selector) {
  const sourceConfig = NEWS_SOURCES[source];
  const items = [];

  for (let page = 1; page <= 2; page++) {
    const pageUrl = page === 1
      ? `${sourceConfig.baseUrl}${categoryUrl}`
      : `${sourceConfig.baseUrl}${categoryUrl.replace('.htm', `${page}.htm`)}`;

    try {
      const response = await axios.get(pageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);

      if (source === 'jwc') {
        // 教务处：table tr td a 结构，标题在 title 属性，日期在 span.PublishDate
        const seenUrls = new Set();
        $('table tr').each((_, row) => {
          const rowEl = $(row);
          // 找所有链接，取第一个有title属性的
          const links = rowEl.find('a[href*="page.htm"]');
          let linkEl = null;
          let href = '';
          let title = '';

          for (let i = 0; i < links.length; i++) {
            const t = $(links[i]).attr('title') || '';
            if (t && !t.includes('教学操作指南')) {
              linkEl = $(links[i]);
              href = linkEl.attr('href') || '';
              title = t;
              break;
            }
          }

          if (!title && links.length > 0) {
            // 如果没找到合适的，取第一个
            linkEl = $(links[0]);
            href = linkEl.attr('href') || '';
            title = linkEl.attr('title') || linkEl.find('a').first().text().trim();
          }

          if (title && href && !seenUrls.has(href)) {
            seenUrls.add(href);
            const dateEl = rowEl.find('span.PublishDate');
            const date = dateEl.text().trim();
            const url = resolveUrl(href, source);

            items.push({
              id: generateId(title, url),
              title,
              url,
              date: parseDate(date),
              source,
              category: categoryName,
              fetchedAt: new Date().toISOString(),
              isRead: false
            });
          }
        });
      }
    } catch (error) {
      console.error(`Error fetching page ${pageUrl}:`, error.message);
    }

    await delay(500);
  }

  return items;
}

export async function fetchAll() {
  const allNews = [];

  for (const source of Object.keys(NEWS_SOURCES)) {
    const sourceConfig = NEWS_SOURCES[source];

    for (const category of sourceConfig.categories) {
      try {
        const news = await fetchCategory(source, category.name, category.url, category.selector);
        allNews.push(...news);
      } catch (error) {
        console.error(`Error fetching ${source}/${category.name}:`, error);
      }
    }
  }

  return allNews;
}

export async function searchOfficial(keyword) {
  // 使用缓存的新闻数据
  const { getNews } = await import('./store.js');
  const allNews = getNews();

  // 用关键词过滤
  const keywordLower = keyword.toLowerCase();
  return allNews.filter(item =>
    item.title.toLowerCase().includes(keywordLower)
  );
}
