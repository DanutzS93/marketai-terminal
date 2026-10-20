const https = require('https');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function run() {
  const js = await fetchText('https://www.londonstrategicedge.com/assets/index-D7UPsv3n.js');
  
  // Find where xr, vs, pr or symbol lists are defined
  const futuresIdx = js.indexOf('"ES.F":"S&P 500 Futures"');
  if (futuresIdx !== -1) {
    console.log('--- FUTURES SYMBOLS DICTIONARY ---');
    console.log(js.slice(futuresIdx - 20, futuresIdx + 1200));
  }

  const indicesIdx = js.indexOf('"SPX500/USD"');
  if (indicesIdx !== -1) {
    console.log('\n--- INDICES / SPOT DICTIONARY ---');
    console.log(js.slice(indicesIdx - 50, indicesIdx + 1200));
  }
}

run().catch(console.error);
