const WebSocket = require('./node_modules/ws');

const apiKey = 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c';
const wsUrl = 'wss://ws.londonstrategicedge.com';

console.log('Connecting to', wsUrl);
const ws = new WebSocket(wsUrl);

const symbolsToSubscribe = [
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

ws.on('open', () => {
  console.log('✅ WebSocket Connected!');
  console.log('Sending auth with api_key:', apiKey);
  ws.send(JSON.stringify({ action: 'auth', api_key: apiKey }));

  for (const sym of symbolsToSubscribe) {
    console.log('Subscribing to:', sym);
    ws.send(JSON.stringify({ action: 'subscribe', symbol: sym }));
  }
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('MESSAGE:', msg.type, JSON.stringify(msg));
  } catch (e) {
    console.log('RAW MSG:', data.toString());
  }
});

ws.on('error', (err) => {
  console.error('❌ WS Error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log('WS Closed:', code, reason.toString());
  process.exit(0);
});

// Run for 12 seconds then close
setTimeout(() => {
  console.log('Done test, closing.');
  ws.close();
  process.exit(0);
}, 12000);
