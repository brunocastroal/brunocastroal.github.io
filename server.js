/**
 * server.js - Zero-dependency local web server for instant preview
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 8080;
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(cleanUrl);
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('400 Bad Request: URL malformada');
  }

  // Prevenção de Path Traversal
  const safePath = path.normalize(decodedUrl).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.resolve(ROOT_DIR, '.' + safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  let statusCode = 200;

  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT_DIR, '404.html');
    statusCode = 404;
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
  } else {
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        const indexFile = path.join(filePath, 'index.html');
        if (fs.existsSync(indexFile)) {
          filePath = indexFile;
        } else {
          filePath = path.join(ROOT_DIR, '404.html');
          statusCode = 404;
        }
      }
    } catch (e) {
      filePath = path.join(ROOT_DIR, '404.html');
      statusCode = 404;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`====================================================`);
  console.log(`  Servidor de teste rodando em: ${url}`);
  console.log(`  Pressione Ctrl+C nesta janela para parar.`);
  console.log(`====================================================`);
  exec(`start ${url}`);
});
