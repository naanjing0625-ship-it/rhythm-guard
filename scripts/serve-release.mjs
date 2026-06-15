import { createServer } from 'http';
import { readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '../release');
const preferredPort = Number(process.env.PORT) || 8080;
const maxPort = preferredPort + 20;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\//, '');
  const normalized = join(root, relative);
  const rootResolved = join(root);
  if (!normalized.startsWith(rootResolved)) return null;
  return normalized;
}

async function ensureBuildExists() {
  try {
    await stat(join(root, 'index.html'));
  } catch {
    console.error('\n缺少 release/index.html，请先在项目根目录运行: npm run deploy:pages\n');
    process.exit(1);
  }
}

function createApp() {
  return createServer(async (req, res) => {
    try {
      const filePath = safePath(req.url ?? '/');
      if (!filePath) {
        res.writeHead(403).end('Forbidden');
        return;
      }

      const info = await stat(filePath);
      if (!info.isFile()) {
        res.writeHead(404).end('Not found');
        return;
      }

      const body = await readFile(filePath);
      const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, '127.0.0.1');
  });
}

await ensureBuildExists();

let port = preferredPort;
let server = createApp();

while (port <= maxPort) {
  try {
    await listen(server, port);
    break;
  } catch (err) {
    if (err.code !== 'EADDRINUSE') {
      console.error(err);
      process.exit(1);
    }
    if (process.env.PORT) {
      console.error(`\n端口 ${port} 已被占用。PowerShell 可换端口: $env:PORT=8081; npm run serve:release\n`);
      process.exit(1);
    }
    port += 1;
    server = createApp();
  }
}

if (port > maxPort) {
  console.error(`\n${preferredPort}–${maxPort} 端口均被占用，请关闭其它本地服务后重试。\n`);
  process.exit(1);
}

console.log('\n✓ Rhythm Guard 本地试玩服务已启动');
if (port !== preferredPort) {
  console.log(`  （8080 已被占用，已自动改用 ${port}）`);
}
console.log(`  http://127.0.0.1:${port}/`);
console.log(`  http://localhost:${port}/`);
console.log('\n按 Ctrl+C 停止\n');
