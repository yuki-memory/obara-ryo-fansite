const NEWS_URL = 'https://obararyo.jp/news/';
const NEWS_LIMIT = 3;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const responseHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=300',
};

const fallbackNews = [
  {
    date: '2026.04.29',
    title: 'お誕生日当日×NEWアルバムレコ発ワンマン 「 My Live Life -STORY- 」開催決定',
    url: 'https://obararyo.jp/news/',
  },
  {
    date: '2025.08.10',
    title: '小原涼初の全曲ワンマン 「bouquet toss💐」開催決定！',
    url: 'https://obararyo.jp/news/',
  },
  {
    date: '2025.02.16',
    title: '生誕ワンマンライブ in 2025 開催決定！',
    url: 'https://obararyo.jp/news/',
  },
];

function decodeHtmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(text) {
  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
}

function normalizeUrl(href) {
  const rawHref = typeof href === 'string' ? href.trim() : '';

  if (!rawHref || rawHref === '#' || rawHref.toLowerCase().startsWith('javascript:')) {
    return '';
  }

  try {
    return new URL(rawHref, NEWS_URL).toString();
  } catch {
    return '';
  }
}

function isValidNewsItem(item) {
  return Boolean(item?.title && item?.url);
}

function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: responseHeaders,
  });
}

class NewsArchiveParser {
  constructor() {
    this.items = [];
    this.currentItem = null;
  }

  beginItem(element) {
    if (this.items.length >= NEWS_LIMIT) {
      return;
    }

    this.currentItem = {
      date: '',
      title: '',
      url: '',
    };

    element.onEndTag(() => {
      if (!this.currentItem) {
        return;
      }

      const item = {
        date: normalizeText(this.currentItem.date),
        title: normalizeText(this.currentItem.title),
        url: normalizeUrl(this.currentItem.url),
      };

      if (isValidNewsItem(item) && this.items.length < NEWS_LIMIT) {
        this.items.push(item);
      }

      this.currentItem = null;
    });
  }

  setUrl(href) {
    if (!this.currentItem || this.currentItem.url) {
      return;
    }

    this.currentItem.url = href || '';
  }

  appendDate(text) {
    if (!this.currentItem) {
      return;
    }

    this.currentItem.date += text;
  }

  appendTitle(text) {
    if (!this.currentItem) {
      return;
    }

    this.currentItem.title += text;
  }
}

async function fetchOfficialNews() {
  const sourceResponse = await fetch(NEWS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 obara-ryo-fansite-news-fetcher',
    },
    cf: {
      cacheTtl: 300,
      cacheEverything: true,
    },
  });

  if (!sourceResponse.ok) {
    throw new Error(`Failed to fetch official news: ${sourceResponse.status}`);
  }

  const parser = new NewsArchiveParser();

  await new HTMLRewriter()
    .on('li.archive_li', {
      element(element) {
        parser.beginItem(element);
      },
    })
    .on('li.archive_li a', {
      element(element) {
        parser.setUrl(element.getAttribute('href'));
      },
    })
    .on('li.archive_li time', {
      text(text) {
        parser.appendDate(text.text);
      },
    })
    .on('li.archive_li p.title', {
      text(text) {
        parser.appendTitle(text.text);
      },
    })
    .transform(sourceResponse)
    .text();

  const items = parser.items.slice(0, NEWS_LIMIT);

  if (items.length === 0) {
    throw new Error('No valid news items found');
  }

  return items;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: responseHeaders,
      });
    }

    if (url.pathname !== '/api/news') {
      return jsonResponse({ error: 'Not found' }, { status: 404 });
    }

    try {
      const news = await fetchOfficialNews();
      return jsonResponse(news, { status: 200 });
    } catch (error) {
      console.warn('[news-worker] fallback to static news', error);
      return jsonResponse(fallbackNews, { status: 200 });
    }
  },
};
