import test from 'node:test';
import assert from 'node:assert/strict';
import { scriptedReply } from '../src/ai/scripted.js';
import { buildSystemPrompt, sanitizeReply } from '../src/ai/persona.js';
import { GhostVoice } from '../src/ai/ghost.js';

const base = { mood: 'guarded', resolved: [], trust: 0, anger: 0, clues: [], truthKnown: false };

test('scripted ghost lies until resolved', () => {
  assert.match(scriptedReply('did you lock the doors?', base), /lock themselves/);
  assert.match(scriptedReply('did you lock the doors?', { ...base, resolved: ['c_doors'] }), /locked them/);
});

test('scripted ghost always answers', () => {
  assert.ok(scriptedReply('zzz', base).length > 0);
});

test('system prompt separates admitted from lies', () => {
  const p = buildSystemPrompt({ ...base, resolved: ['c_doors'] });
  assert.match(p, /locked the doors yourself/);
  assert.match(p, /Nobody was in the lab/);
  assert.doesNotMatch(p, /\"I never locked the doors/);
});

test('sanitizeReply strips think blocks and truncates', () => {
  assert.equal(sanitizeReply('<think>x</think> hi'), 'hi');
  assert.ok(sanitizeReply('word '.repeat(300)).length <= 410);
});

test('falls back to scripted when provider unreachable', async () => {
  const v = new GhostVoice({ HAUNTED_PROVIDER: 'ollama', HAUNTED_BASE_URL: 'http://127.0.0.1:9' });
  const r = await v.reply('hello', base);
  assert.equal(r.source, 'scripted'); assert.ok(v.status().lastError);
});

test('uses openai-compatible provider when available', async () => {
  const http = await import('node:http');
  const srv = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ choices: [{ message: { content: 'i see you.' } }] })); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${srv.address().port}`;
  const v = new GhostVoice({ HAUNTED_PROVIDER: 'llamacpp', HAUNTED_BASE_URL: url });
  const r = await v.reply('hello', base);
  srv.close();
  assert.deepEqual(r, { text: 'i see you.', source: 'llamacpp' });
});
