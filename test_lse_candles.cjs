const https = require('https');

const key = '71f880e1d2ef471664f3b6c04c6dc1e618f94e51f68c87522bc6dcbc0ca173a5';

async function fetchLatestCandle(symbol) {
  return new Promise((resolve) => {
    const url = `https://api.londonstrategicedge.com/x_candles_5m?symbol=eq.${encodeURIComponent(symbol)}&order=timestamp.desc&limit=1`;
    https.get(url, { headers: { 'x-api-key': key } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ symbol, data: JSON.parse(data) });
        } catch (e) {
          resolve({ symbol, text: data.slice(0, 100) });
        }
      });
    }).on('error', err => resolve({ symbol, error: err.message }));
  });
}

async function run() {
  const symbols = [
    'NAS100/USD',
    'SPX500/USD',
    'US30/USD',
    'XAU/USD',
    'NQ.F',
    'ES.F',
    'GC.F',
    'EUR/USD',
    'GBP/USD',
    'USD/JPY'
  ];

  for (const s of symbols) {
    const r = await fetchLatestCandle(s);
    console.log(s, '=>', r.data && r.data[0] ? `close: ${r.data[0].close} | high: ${r.data[0].high} | low: ${r.data[0].low} | open: ${r.data[0].open} | time: ${r.data[0].timestamp}` : r);
  }
}

run().catch(console.error);
