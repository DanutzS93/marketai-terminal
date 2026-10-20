const WebSocket = require('./node_modules/ws');

const apiKey = 'lse_live_9d965aeeefa18fa9c7225990bf4e4f4c';
const ws = new WebSocket('wss://ws.londonstrategicedge.com');

const testSymbols = [
  'US30/USD',
  'US30',
  'DOW/USD',
  'DJI/USD',
  'YM.F',
  'DOW.F',
  'WALLSTREET',
  'NAS100/USD',
  'SPX500/USD',
  'US500/USD'
];

ws.on('open', () => {
  console.log('Connected, sending auth...');
  ws.send(JSON.stringify({ action: 'auth', api_key: apiKey }));
  for (const s of testSymbols) {
    ws.send(JSON.stringify({ action: 'subscribe', symbol: s }));
  }
});

ws.on('message', (d) => {
  const msg = JSON.parse(d.toString());
  if (msg.type === 'subscribed' || msg.type === 'error' || msg.type === 'tick') {
    console.log(msg.type, msg.symbol, msg.price || msg.code || msg.message);
  }
});

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 8000);
