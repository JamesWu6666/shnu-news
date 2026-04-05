import streamlit as st
import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import time

# 配置
DATA_FILE = 'news_data.json'
BOOKMARKS_FILE = 'bookmarks.json'
JWC_URL = 'https://jwc.shnu.edu.cn'
CATEGORIES = {
    '学生公告': '/17118/list.htm',
    '大创通知': '/17003/list.htm',
    '学科竞赛': '/17030/list.htm'
}

# 关键词过滤
KEYWORDS = ['竞赛', '大创', '保研', '奖学金', '夏令营', '保送']
EXCLUDE = ['研究生', '硕士', '博士']

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {'news': [], 'lastFetch': ''}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_bookmarks():
    if os.path.exists(BOOKMARKS_FILE):
        with open(BOOKMARKS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_bookmarks(bookmarks):
    with open(BOOKMARKS_FILE, 'w', encoding='utf-8') as f:
        json.dump(bookmarks, f, ensure_ascii=False, indent=2)

def fetch_page(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.encoding = 'utf-8'
        return resp.text
    except:
        return ''

def parse_news(html):
    news = []
    soup = BeautifulSoup(html, 'html.parser')
    rows = soup.find_all('tr')

    for row in rows:
        links = row.find_all('a', href=lambda h: h and 'page.htm' in h)
        title = ''
        href = ''

        for link in links:
            t = link.get('title', '')
            if t and '教学操作指南' not in t:
                title = t
                href = link.get('href', '')
                break

        if not title and links:
            link = links[0]
            title = link.get('title') or link.text.strip()
            href = link.get('href', '')

        if title and href:
            date_el = row.find('span', class_='PublishDate')
            date = date_el.text.strip() if date_el else ''

            news.append({
                'title': title,
                'url': JWC_URL + href if href.startswith('/') else href,
                'date': date,
                'source': 'jwc',
                'category': '教务处'
            })

        time.sleep(0.3)

    return news

def fetch_all_news():
    all_news = []
    for name, path in CATEGORIES.items():
        url = JWC_URL + path
        html = fetch_page(url)
        if html:
            news = parse_news(html)
            for n in news:
                n['category'] = name
            all_news.extend(news)

            # 第二页
            page2_url = url.replace('.htm', '2.htm')
            html2 = fetch_page(page2_url)
            if html2:
                news2 = parse_news(html2)
                for n in news2:
                    n['category'] = name
                all_news.extend(news2)

        time.sleep(0.5)

    # 过滤
    filtered = []
    for n in all_news:
        title = n['title']
        if any(kw in title for kw in KEYWORDS):
            if not any(ex in title for ex in EXCLUDE):
                filtered.append(n)

    # 按日期排序
    filtered.sort(key=lambda x: x['date'], reverse=True)

    return filtered

# Streamlit 界面
st.set_page_config(page_title='竞赛通知', page_icon='📢')

st.title('📢 竞赛 & 学业通知')

# 刷新按钮
if st.button('🔄 刷新数据'):
    with st.spinner('正在获取数据...'):
        news = fetch_all_news()
        data = {'news': news, 'lastFetch': datetime.now().isoformat()}
        save_data(data)
        st.success(f'获取了 {len(news)} 条通知')

# 加载数据
data = load_data()
news = data.get('news', [])
last_fetch = data.get('lastFetch', '')

if last_fetch:
    st.caption(f'最后刷新: {last_fetch[:19].replace("T", " ")}')

# 标签页
tab1, tab2 = st.tabs(['📋 通知列表', '⭐ 收藏'])

with tab1:
    st.header('教务处通知')

    # 搜索框
    search = st.text_input('🔍 搜索通知')

    # 筛选
    selected_cat = st.multiselect('筛选类别', list(CATEGORIES.keys()), default=list(CATEGORIES.keys()))

    # 显示
    for n in news:
        if search and search.lower() not in n['title'].lower():
            continue
        if n['category'] not in selected_cat:
            continue

        with st.container():
            col1, col2 = st.columns([1, 4])
            with col1:
                st.markdown(f"**{n['date']}**")
            with col2:
                st.markdown(f"**{n['title']}**")
                st.caption(f"{n['category']}")

                # 操作按钮
                b1, b2 = st.columns([1, 1])
                with b1:
                    if st.button('📖 打开', key=f"open_{n['url']}"):
                        st.markdown(f"[点击打开]({n['url']})")
                with b2:
                    bm = load_bookmarks()
                    is_bm = any(b['url'] == n['url'] for b in bm)
                    if st.button('⭐ 收藏' if not is_bm else '✓ 已收藏',
                                key=f"bm_{n['url']}"):
                        if not is_bm:
                            bm.append({'title': n['title'], 'url': n['url'], 'remark': ''})
                            save_bookmarks(bm)
                            st.rerun()

with tab2:
    st.header('我的收藏')

    bm = load_bookmarks()

    if not bm:
        st.info('暂无收藏')
    else:
        for i, b in enumerate(bm):
            with st.container():
                st.markdown(f"**{b['title']}**")
                st.caption(b['url'])

                # 备注编辑
                new_remark = st.text_input(
                    '备注',
                    value=b.get('remark', ''),
                    key=f"remark_{i}",
                    label_visibility='collapsed'
                )
                if new_remark != b.get('remark', ''):
                    b['remark'] = new_remark
                    save_bookmarks(bm)
                    st.rerun()

                if st.button('🗑️ 删除', key=f"del_{i}"):
                    bm.pop(i)
                    save_bookmarks(bm)
                    st.rerun()

                st.divider()
