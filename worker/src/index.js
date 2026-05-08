const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

const mockNews = [
  {
    date: '2026.05.17',
    title: 'My Live Life -STORY- 開催',
    url: 'https://obararyo.jp/news/',
  },
  {
    date: '2026.05.01',
    title: 'ライブ出演情報を更新しました',
    url: 'https://obararyo.jp/news/',
  },
];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname !== '/api/news') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify(mockNews), {
      status: 200,
      headers: corsHeaders,
    });
  },
};
