const WebSocket = require('./node_modules/ws');

const apiKey = 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c';
const ws = new WebSocket('wss://ws.londonstrategicedge.com');

const subs = [
  'NAS100/USD',
  'SPX500/USD',
  'US30/USD',
  'DOW.F',
  'XAU/USD',
  'NQ.F',
  'ES.F',
  'GC.F',
  'EUR/USD',
  'GBP/USD',
  'USD/JPY'
];

const receivedTicks = {};

ws.on('open', () => {
  console.log('Connected to wss://ws.londonstrategicedge.com');
  ws.send(JSON.stringify({ action: 'auth', api_key: apiKey }));
  for (const s of subs) {
    ws.send(JSON.stringify({ action: 'subscribe', symbol: s }));
  }
});

ws.on('message', (d) => {
  const msg = JSON.parse(d.toString());
  if (msg.type === 'tick') {
    receivedTicks[msg.symbol] = {
      price: msg.price,
      bid: msg.bid,
      ask: msg.ask,
      ts: msg.ts,
      time: new Date(msg.ts * 1000).toISOString()
    };
    console.log(`[TICK] ${msg.symbol.padEnd(14)} => Price: ${msg.price} (bid: ${msg.bid}, ask: ${msg.ask})`);
  } else if (msg.type === 'subscribed') {
    console.log(`[SUBSCRIBED] ${msg.symbol}`);
  } else if (msg.type === 'error') {
    console.log(`[ERROR] ${msg.code}: ${msg.message}`);
  }
});

setTimeout(() => {
  console.log('\n--- SUMMARY OF RECEIVED TICKS ---');
  console.log(JSON.stringify(receivedTicks, null, 2));
  ws.close();
  process.exit(0);
}, 15000);
