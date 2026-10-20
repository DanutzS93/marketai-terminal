const WebSocket = require('./node_modules/ws');

const apiKey = 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c';
const ws = new WebSocket('wss://ws.londonstrategicedge.com');

// Test various possible symbols for Dow Jones
const dowCandidates = [
  'DOW.F',
  'US30/USD',
  'US30',
  'DJI/USD',
  'DJI',
  'YM.F',
  'YM=F',
  'YM1!',
  'MYM.F',
  'DJIA/USD',
  'WALLSTREET/USD',
  'US30.F',
  'DOWJONES/USD',
  'DOW30/USD',
  'INDU/USD'
];

ws.on('open', () => {
  ws.send(JSON.stringify({ action: 'auth', api_key: apiKey }));
  for (const sym of dowCandidates) {
    ws.send(JSON.stringify({ action: 'subscribe', symbol: sym }));
  }
});

ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.type === 'subscribed') {
    console.log('✅ SUBSCRIBED:', m.symbol);
  } else if (m.type === 'tick') {
    console.log('⭐ TICK:', m.symbol, m.price, m.bid, m.ask);
  } else if (m.type === 'error' && m.code !== 'INVALID_SYMBOL') {
    console.log('❌ ERROR:', m.code, m.message);
  }
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 15000);
