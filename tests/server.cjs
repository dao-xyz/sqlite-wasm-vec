/* Simple static server with COOP/COEP headers for Playwright */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const port = process.env.PORT ? Number(process.env.PORT) : 4321;
const host = process.env.HOST || '127.0.0.1';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // Log each incoming request for debugging
  console.log(`[server] ${req.method} ${urlPath}`);
  let filePath = path.join(root, urlPath);
  if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const type = mime[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.end());
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  console.error('[server] listen error on', host, port, String(err && err.message || err));
  if (host !== '0.0.0.0') {
    console.log('[server] falling back to 0.0.0.0');
    server.listen(port, '0.0.0.0', () => {
      console.log(`[server] listening on http://0.0.0.0:${port}`);
    });
  }
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://${host}:${port}`);
});
