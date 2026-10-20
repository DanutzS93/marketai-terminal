const https = require('https');

const anonKey = '71f880e1d2ef471664f3b6c04c6dc1e618f94e51f68c87522bc6dcbc0ca173a5';
const userKey = 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c';

async function fetchTable(table, key) {
  return new Promise((resolve) => {
    const url = `https://api.londonstrategicedge.com/${table}?limit=2`;
    https.get(url, { headers: { 'x-api-key': key, 'apikey': key, 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ table, status: res.statusCode, data: data.slice(0, 300) });
      });
    }).on('error', err => resolve({ table, error: err.message }));
  });
}

async function run() {
  const candidates = [
    'x_candles_1m',
    'x_candles_5m',
    'x_candles_1h',
    'x_candles_1d',
    'candles_1m',
    'candles_1d',
    'd_candles_1d',
    'oanda_candles_1d',
    'instruments',
    'tickers',
    'symbols',
    'quotes',
    'latest_quotes',
    'prices',
    'market_summary'
  ];

  console.log('--- Testing with anonKey ---');
  for (const c of candidates) {
    const r = await fetchTable(c, anonKey);
    if (r.status === 200) {
      console.log(`✅ [${c}]: 200 OK ->`, r.data.slice(0, 150));
    }
  }

  console.log('\n--- Testing with userKey ---');
  for (const c of candidates) {
    const r = await fetchTable(c, userKey);
    if (r.status === 200) {
      console.log(`✅ [${c}]: 200 OK ->`, r.data.slice(0, 150));
    }
  }
}

run().catch(console.error);
