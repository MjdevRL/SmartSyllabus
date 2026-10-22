// Local preview: `npm run dev` then open http://localhost:8080 (site) and http://localhost:8080/admin/ (dashboard).
// The dashboard saves straight into this folder through decap-server (no GitHub login needed locally).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8080);
const env = { ...process.env, CMS_LOCAL: '1', SITE_BASE: '/' };
const build = () => { const r = spawnSync(process.execPath, ['build/build.mjs'], { cwd: ROOT, env, encoding: 'utf8' }); console.log(r.status === 0 ? `[${new Date().toLocaleTimeString()}] rebuilt` : r.stdout + r.stderr); };
spawnSync(process.execPath, ['build/build.mjs', '--check'], { cwd: ROOT, env, stdio: 'ignore' });
build();

let t;
for (const d of ['content', 'assets', 'admin', 'build', 'public']) fs.watch(path.join(ROOT, d), { recursive: true }, () => { clearTimeout(t); t = setTimeout(() => { spawnSync(process.execPath, ['build/build.mjs', '--check'], { cwd: ROOT, env, stdio: 'ignore' }); build(); }, 400); });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.yml': 'text/yaml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.txt': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': TYPES['.html'] }); fs.createReadStream(path.join(DIST, '404.html')).pipe(res); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`Site:      http://localhost:${PORT}/\nDashboard: http://localhost:${PORT}/admin/`));

// Start the local save helper with Node directly (works on Windows, macOS and Linux).
const helper = path.join(ROOT, 'node_modules', 'decap-server', 'dist', 'index.js');
if (!fs.existsSync(helper)) {
  console.log('\nThe dashboard save helper is missing. Run "npm install" in this folder, then "npm run dev" again.');
} else {
  const child = spawn(process.execPath, [helper], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, PORT: '8081' } });
  child.on('error', (e) => console.log('\nCould not start the dashboard save helper:', e.message, '\nThe website preview still works at http://localhost:' + PORT + '/'));
  child.on('exit', (code) => { if (code) console.log('\nThe dashboard save helper stopped (code ' + code + '). Is something else using port 8081? Close other "npm run dev" windows and try again.'); });
}
