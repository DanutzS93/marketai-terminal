const https = require('https');

const apiKey = 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c';

async function fetchJson(url, headers = {}) {
  return new Promise((resolve) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data.slice(0, 500) });
        }
      });
    }).on('error', err => resolve({ error: err.message }));
  });
}

async function run() {
  const eps = [
    'https://data-api.londonstrategicedge.com/v1/quotes',
    'https://data-api.londonstrategicedge.com/quotes',
    'https://data-api.londonstrategicedge.com/tickers',
    'https://data-api.londonstrategicedge.com/catalog',
    'https://data-api.londonstrategicedge.com/instruments',
    'https://api.londonstrategicedge.com/rpc/get_live_quotes',
    'https://api.londonstrategicedge.com/rpc/quotes',
    'https://api.londonstrategicedge.com/rpc/market_overview',
    'https://api.londonstrategicedge.com/market_quotes',
    'https://api.londonstrategicedge.com/v_live_quotes',
    'https://api.londonstrategicedge.com/x_prices',
  ];

  for (const ep of eps) {
    const res = await fetchJson(ep, { 'x-api-key': apiKey });
    console.log(ep, '=> Status:', res.status, res.data ? (Array.isArray(res.data) ? `Array[${res.data.length}]` : typeof res.data) : res.text || res.error);
  }
}

run().catch(console.error);
