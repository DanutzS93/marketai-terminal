const https = require('https');

const key = '71f880e1d2ef471664f3b6c04c6dc1e618f94e51f68c87522bc6dcbc0ca173a5';

async function fetchDaily(symbol) {
  return new Promise((resolve) => {
    const url = `https://api.londonstrategicedge.com/x_candles_1d?symbol=eq.${encodeURIComponent(symbol)}&order=timestamp.desc&limit=2`;
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
    const r = await fetchDaily(s);
    if (r.data && r.data.length > 0) {
      const today = r.data[0];
      const prev = r.data[1] || today;
      const change = today.close - prev.close;
      const changePct = ((change / prev.close) * 100).toFixed(2);
      console.log(`[${s}] Today close: ${today.close} | Prev close: ${prev.close} | High: ${today.high} | Low: ${today.low} | Change: ${change.toFixed(2)} (${changePct}%)`);
    } else {
      console.log(`[${s}] No data:`, r);
    }
  }
}

run().catch(console.error);
