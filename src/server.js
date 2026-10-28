import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Game } from './engine/game.js';
import { OBJECTS } from './engine/story.js';
import { GhostVoice } from './ai/ghost.js';
import { listProviders } from './ai/providers.js';
import { Bus, translateInput } from './hardware/bus.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const MAX_SESSIONS = 50;
const MAX_BODY = 4096;

export function createApp({ env = process.env, now = () => Date.now() } = {}) {
  const bus = new Bus();
  const voice = new GhostVoice(env);
  const sessions = new Map();

  function newSession() {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
    const id = randomUUID();
    const s = { id, game: new Game({ now, onEvent: (e) => bus.publish(e) }), history: [], busy: false };
    sessions.set(id, s);
    return s;
  }

  const send = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

  async function readBody(req) {
    let size = 0; const chunks = [];
    for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new Error('body too large'); chunks.push(c); }
    if (!chunks.length) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('bad json'); }
  }

  async function api(req, res, url) {
    const route = `${req.method} ${url.pathname}`;
    if (route === 'GET /api/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': hi\n\n');
      const unsub = bus.subscribe((e) => res.write(`data: ${JSON.stringify(e)}\n\n`));
      req.on('close', unsub);
      return;
    }
    if (route === 'POST /api/new') { const s = newSession(); return send(res, 200, { sid: s.id, state: s.game.snapshot(), ai: voice.status() }); }
    if (route === 'GET /api/providers') return send(res, 200, { current: voice.status(), providers: await listProviders(env) });
    if (route === 'POST /api/config') {
      const b = await readBody(req);
      return voice.setProvider(b.provider, b.model) ? send(res, 200, voice.status()) : send(res, 400, { error: 'unknown provider' });
    }

    const s = sessions.get(req.headers['x-session']);
    if (!s) return send(res, 404, { error: 'no session' });
    const g = s.game;
    const reply = (r) => send(res, r.ok === false ? 400 : 200, { result: r, state: g.snapshot() });

    switch (route) {
      case 'GET /api/state': return send(res, 200, { state: g.snapshot(), ai: voice.status() });
      case 'POST /api/start': return reply(g.start());
      case 'POST /api/examine': return reply(g.examine((await readBody(req)).id));
      case 'POST /api/present': { const b = await readBody(req); return reply(g.present(b.clue, b.claim)); }
      case 'POST /api/decide': return reply(g.decide((await readBody(req)).choice));
      case 'POST /api/chat': {
        const b = await readBody(req);
        const msg = String(b.message ?? '').trim().slice(0, 300);
        if (!msg) return send(res, 400, { error: 'empty message' });
        if (g.snapshot().phase !== 'playing') return send(res, 400, { error: 'not playing' });
        if (s.busy) return send(res, 429, { error: 'ghost is thinking' });
        s.busy = true;
        try {
          const ctx = g.ghostContext();
          const r = await voice.reply(msg, ctx, s.history);
          if (g.snapshot().phase !== 'playing') return send(res, 400, { error: 'not playing' });
          g.say('player', msg);
          g.say('ghost', r.text);
          s.history.push({ role: 'user', content: msg }, { role: 'assistant', content: r.text });
          if (s.history.length > 16) s.history.splice(0, 2);
          return send(res, 200, { result: { ok: true, reply: r.text, source: r.source }, state: g.snapshot() });
        } finally { s.busy = false; }
      }
      case 'POST /api/hardware/event': {
        const act = translateInput(await readBody(req), OBJECTS.map((o) => o.id));
        if (!act) return send(res, 400, { error: 'unsupported event' });
        if (act.action === 'examine') return reply(g.examine(act.id));
        bus.publish({ type: 'ambient', name: act.name, value: act.value });
        return send(res, 200, { result: { ok: true }, state: g.snapshot() });
      }
      default: return send(res, 404, { error: 'not found' });
    }
  }

  async function serveStatic(res, pathname) {
    const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) await api(req, res, url);
      else await serveStatic(res, url.pathname);
    } catch (e) {
      if (!res.headersSent) send(res, 400, { error: e.message === 'body too large' ? 'body too large' : 'bad request' });
      else res.end();
    }
  });

  return { server, bus, voice, sessions };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '127.0.0.1';
  const { server, voice } = createApp();
  server.listen(port, host, () => {
    console.log(`HAUNTED.EXE running at http://${host}:${port}  (ghost provider: ${voice.status().provider})`);
  });
}
