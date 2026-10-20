const https = require('https');

const LSE_REST_KEY = '71f880e1d2ef471664f3b6c04c6dc1e618f94e51f68c87522bc6dcbc0ca173a5';

async function fetchLseCandles(symbol, limit = 30) {
  return new Promise((resolve) => {
    const url = `https://api.londonstrategicedge.com/x_candles_1d?symbol=eq.${encodeURIComponent(symbol)}&order=timestamp.desc&limit=${limit}`;
    https.get(url, { headers: { 'x-api-key': LSE_REST_KEY, 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function testAll() {
  const symbolMap = {
    NASDAQ: { lseSym: 'NAS100/USD', name: 'Nasdaq 100 CFD', symbol: 'NAS100', decimals: 2 },
    SPX500: { lseSym: 'SPX500/USD', name: 'S&P 500 CFD', symbol: 'SPX500', decimals: 2 },
    DOW_JONES: { lseSym: 'US30/USD', name: 'Dow Jones CFD', symbol: 'US30', decimals: 2 },
    GOLD: { lseSym: 'XAU/USD', name: 'Gold Spot (XAU/USD)', symbol: 'XAU/USD', decimals: 2 },
    NQ_F: { lseSym: 'NQ.F', name: 'Nasdaq 100 Futures', symbol: 'NQ.F', decimals: 2 },
    ES_F: { lseSym: 'ES.F', name: 'S&P 500 Futures', symbol: 'ES.F', decimals: 2 },
    GC_F: { lseSym: 'GC.F', name: 'Gold Futures', symbol: 'GC.F', decimals: 2 },
    EURUSD: { lseSym: 'EUR/USD', name: 'EUR/USD (Euro / US Dollar)', symbol: 'EUR/USD', decimals: 5 },
    GBPUSD: { lseSym: 'GBP/USD', name: 'GBP/USD (British Pound / US Dollar)', symbol: 'GBP/USD', decimals: 5 },
    USDJPY: { lseSym: 'USD/JPY', name: 'USD/JPY (US Dollar / Japanese Yen)', symbol: 'USD/JPY', decimals: 3 },
  };

  const results = {};
  for (const [key, spec] of Object.entries(symbolMap)) {
    const candles = await fetchLseCandles(spec.lseSym, 30);
    if (candles && candles.length > 0) {
      const today = candles[0];
      const prev = candles[1] || today;
      const price = Number(today.close.toFixed(spec.decimals));
      const previousClose = Number(prev.close.toFixed(spec.decimals));
      const change = Number((price - previousClose).toFixed(spec.decimals));
      const changePercent = Number((((price - previousClose) / previousClose) * 100).toFixed(2));
      results[key] = {
        name: spec.name,
        price,
        previousClose,
        change,
        changePercent,
        high: today.high,
        low: today.low,
        open: today.open,
        candlesCount: candles.length
      };
    } else {
      results[key] = { error: 'No candles returned' };
    }
  }

  console.log('RESULTS:');
  console.log(JSON.stringify(results, null, 2));
}

testAll();
