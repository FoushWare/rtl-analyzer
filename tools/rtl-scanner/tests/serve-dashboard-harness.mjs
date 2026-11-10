import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const html = (await readFile(join(process.env.RTL_E2E_DASHBOARD ?? process.cwd(), 'rtl-report-dashboard.html'), 'utf8')).replaceAll('127.0.0.1:4318', '127.0.0.1:4319');
const server = http.createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://127.0.0.1:4320').pathname === '/rtl-report-dashboard.html' ? html : null;
  if (path === null) { response.writeHead(404); response.end('not found'); return; }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); response.end(path);
});
server.listen(4320, '127.0.0.1');
