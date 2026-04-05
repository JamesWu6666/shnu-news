import axios from 'axios';
import { QWEN_API_URL, QWEN_API_KEY } from './constant.js';

function getSourceLabel(source) {
  switch (source) {
    case 'shnu': return '师大';
    case 'jwc': return '教务处';
    case 'xxjd': return '信机';
    default: return source;
  }
}

export async function summarizeNews(news) {
  const apiKey = QWEN_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return news.map(item => ({ ...item, summary: '' }));
  }

  const newsList = news.map((item, index) =>
    `${index + 1}. [${getSourceLabel(item.source)}] ${item.title} (${item.date})`
  ).join('\n');

  const systemPrompt = `你是一个新闻摘要助手。为每条新闻生成50-100字的中文摘要，包含以下内容：
1. 通知对象（谁可以申请/参与）
2. 核心内容（是什么）
3. 关键时间或截止日期（如有）

格式要求：
- 每条摘要50-100字
- 语言简洁专业
- 直接切入正题，不废话`; // Optimized prompt

  const userPrompt = `新闻列表：
${newsList}

请为每条新闻生成50-100字摘要，格式如下：
1. 摘要内容
---
2. 摘要内容
---
（用"---"分隔）`;

  try {
    const response = await axios.post(QWEN_API_URL, {
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const result = response.data.choices?.[0]?.message?.content || '';
    const summaries = result.split(/---|\n\d+\./).filter(s => s.trim());

    return news.map((item, index) => ({
      ...item,
      summary: summaries[index]?.trim().substring(0, 150) || ''
    }));
  } catch (error) {
    console.error('Summary error:', error.message);
    return news.map(item => ({ ...item, summary: '' }));
  }
}

export async function filterNews(news, prompt) {
  const apiKey = QWEN_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('请先在 constant.js 中配置千问API密钥');
  }

  const newsList = news.map((item, index) =>
    `${index + 1}. [${getSourceLabel(item.source)}] ${item.title} (${item.date})`
  ).join('\n');

  const systemPrompt = `你是一个精准的新闻筛选助手。

筛选规则：
- "竞赛"：包含竞赛、比赛、大赛、联赛等同类词
- "保研"：推荐免试研究生、研究生保送相关
- "奖学金"：各类奖助学金申请
- "大创"：大学生创新创业项目
- "夏令营"：暑期夏令营活动

严格标准：
1. 标题核心主题必须与筛选条件高度相关
2. 分类标签匹配不算，必须标题内容真正相关
3. 宁可少而精，不要多而杂
4. 最多返回10条`; // Optimized prompt

  const userPrompt = `筛选条件：${prompt}

新闻列表：
${newsList}

只返回高度相关的新闻序号，用逗号分隔，如：1,3,5
如无相关内容，只返回"无"`;

  try {
    const response = await axios.post(QWEN_API_URL, {
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const result = response.data.choices?.[0]?.message?.content || '';

    if (result.trim() === '无' || !result.trim()) {
      return [];
    }

    const indices = result.split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0 && n <= news.length);

    return indices.map(i => news[i - 1].id);
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('千问API密钥无效，请检查配置');
    }
    if (error.code === 'ECONNABORTED') {
      throw new Error('千问API请求超时，请重试');
    }
    throw error;
  }
}

export async function aiSearch(keyword, news) {
  const apiKey = QWEN_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return [{
      id: 'error_1',
      title: '请配置 QWEN_API_KEY',
      url: '',
      date: new Date().toISOString().split('T')[0],
      source: 'system',
      category: '错误',
      aiSummary: '请在 .env 文件中配置有效的 API Key',
      relevance: 'high'
    }];
  }

  try {
    // 直接让AI回答，不使用web search工具
    const response = await axios.post(QWEN_API_URL, {
      model: 'qwen-plus',
      messages: [
        {
          role: 'system',
          content: '你是一个上海师范大学信息助手，请根据你的知识回答用户关于上海师范大学教务处通知的问题。如果不知道，请明确说不知道。'
        },
        {
          role: 'user',
          content: `请搜索并总结与"${keyword}"相关的上海师范大学教务处通知公告，包括：标题、链接（如有）、内容摘要。`
        }
      ],
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const content = response.data.choices?.[0]?.message?.content;

    if (content) {
      return [{
        id: 'ai_response_' + Date.now(),
        title: '千问AI回答',
        url: '',
        date: new Date().toISOString().split('T')[0],
        source: 'qwen',
        category: 'AI搜索',
        aiSummary: content,
        relevance: 'high'
      }];
    }

    return [{
      id: 'no_result',
      title: '未找到结果',
      url: '',
      date: new Date().toISOString().split('T')[0],
      source: 'qwen',
      category: '搜索',
      aiSummary: '未找到与关键词相关的搜索结果',
      relevance: 'medium'
    }];

  } catch (error) {
    console.error('AI Search error:', error.message);
    return [{
      id: 'error_' + Date.now(),
      title: '搜索失败',
      url: '',
      date: new Date().toISOString().split('T')[0],
      source: 'error',
      category: '错误',
      aiSummary: `错误: ${error.message}`,
      relevance: 'high'
    }];
  }
}
