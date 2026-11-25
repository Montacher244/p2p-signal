// Tiny signaling server for the P2P game. Only passes the first handshake messages
// between players (room codes). Game data never goes through here.
const http = require('http');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
  res.end('signaling ok');
});
const wss = new WebSocketServer({ server });
const clients = new Map(); // id -> socket

wss.on('connection', (ws, req) => {
  const id = new URL(req.url, 'http://x').searchParams.get('id');
  if (!id || id.length > 64) { ws.close(); return; }
  if (clients.has(id)) { ws.send(JSON.stringify({ type: 'ID-TAKEN' })); ws.close(); return; }
  clients.set(id, ws);
  ws.send(JSON.stringify({ type: 'OPEN' }));
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'HEARTBEAT') return;
    const dst = clients.get(m.dst);
    if (!dst) { ws.send(JSON.stringify({ type: 'EXPIRE', src: m.dst })); return; }
    dst.send(JSON.stringify({ type: m.type, src: id, dst: m.dst, payload: m.payload }));
  });
  ws.on('close', () => { if (clients.get(id) === ws) clients.delete(id); });
});

// drop dead connections
setInterval(() => wss.clients.forEach(s => { if (s.isAlive === false) return s.terminate(); s.isAlive = false; s.ping(); }), 30000);
wss.on('connection', s => { s.isAlive = true; s.on('pong', () => s.isAlive = true); });

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log('signaling on', PORT));
