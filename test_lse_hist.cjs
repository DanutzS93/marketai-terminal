const https = require('https');

const key = '71f880e1d2ef471664f3b6c04c6dc1e618f94e51f68c87522bc6dcbc0ca173a5';

async function fetchHist(symbol) {
  return new Promise((resolve) => {
    const url = `https://api.londonstrategicedge.com/x_candles_1d?symbol=eq.${encodeURIComponent(symbol)}&order=timestamp.desc&limit=30`;
    https.get(url, { headers: { 'x-api-key': key } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const arr = JSON.parse(data);
          resolve({ symbol, count: arr.length, latest: arr[0]?.close, oldest: arr[arr.length - 1]?.close });
        } catch (e) {
          resolve({ symbol, error: e.message });
        }
      });
    }).on('error', err => resolve({ symbol, error: err.message }));
  });
}

async function run() {
  const list = ['NAS100/USD', 'SPX500/USD', 'US30/USD', 'XAU/USD', 'NQ.F', 'ES.F', 'GC.F', 'EUR/USD', 'GBP/USD', 'USD/JPY'];
  for (const s of list) {
    const r = await fetchHist(s);
    console.log(s, '=>', r);
  }
}

run();
