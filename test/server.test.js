import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

test('full game over HTTP, offline', async () => {
  const { server } = createApp({ env: {} });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (p, method = 'GET', body, sid) => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', 'x-session': sid || '' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, json: await r.json() };
  };
  const { json: n } = await call('/api/new', 'POST');
  const sid = n.sid;
  assert.equal((await call('/api/chat', 'POST', { message: 'hi' }, sid)).status, 400);
  await call('/api/start', 'POST', undefined, sid);
  const chat = await call('/api/chat', 'POST', { message: 'who are you' }, sid);
  assert.equal(chat.json.result.source, 'scripted');
  await call('/api/examine', 'POST', { id: 'photo' }, sid);
  assert.equal((await call('/api/hardware/event', 'POST', { type: 'button', id: 'badge' }, sid)).status, 200);
  assert.equal((await call('/api/hardware/event', 'POST', { type: 'sensor', name: 'motion', value: 1 }, sid)).status, 200);
  assert.equal((await call('/api/hardware/event', 'POST', { type: 'evil' }, sid)).status, 400);
  const p = await call('/api/present', 'POST', { clue: 'photo', claim: 'c_nobody' }, sid);
  assert.equal(p.json.result.correct, true);
  const d = await call('/api/decide', 'POST', { choice: 'contain' }, sid);
  assert.equal(d.json.state.ending.id, 'static');
  assert.equal((await call('/api/state', 'GET', undefined, 'bogus')).status, 404);
  const page = await fetch(base + '/'); assert.equal(page.status, 200);
  assert.equal((await fetch(base + '/..%2fpackage.json')).status, 403);
  server.close();
});
