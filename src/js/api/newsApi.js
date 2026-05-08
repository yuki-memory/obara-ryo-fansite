const NEWS_API_URL = 'https://YOUR_WORKER_URL/api/news';

export async function fetchOfficialNews() {
  const response = await fetch(NEWS_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch news: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid news response');
  }

  return data;
}
