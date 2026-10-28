const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const ctx = canvas.getContext('2d');

let sid = null, state = null, selectedClue = null, lastLogKey = '', muted = false, voiceOn = false;
let glitch = 0, flash = 0, t = 0, mouse = { x: -1, y: -1 };

const SPOTS = {
  terminal: [0.1, 0.28], badge: [0.08, 0.46], photo: [0.17, 0.62],
  musicbox: [0.56, 0.58], voicemail: [0.57, 0.3], notice: [0.36, 0.12]
};
const MOODS = { guarded: '#39ff88', uneasy: '#d8ff39', angry: '#ff3355', calm: '#7fd6ff', afraid: '#c9a7ff' };

// ---------- API ----------
async function api(path, method = 'GET', body) {
  const res = await fetch(path, { method, headers: { 'content-type': 'application/json', 'x-session': sid || '' }, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}

// ---------- Audio ----------
let ac, drone, beatAt = 0;
function initAudio() {
  if (ac) return;
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    drone = ac.createOscillator(); const g = ac.createGain(); const lp = ac.createBiquadFilter();
    drone.type = 'sawtooth'; drone.frequency.value = 43; lp.frequency.value = 160; g.gain.value = 0.05;
    drone.connect(lp); lp.connect(g); g.connect(ac.destination); drone.start();
    const lfo = ac.createOscillator(); const lg = ac.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 6; lfo.connect(lg); lg.connect(drone.frequency); lfo.start();
  } catch { ac = null; }
}
function blip(freq = 220, dur = 0.15, type = 'square', vol = 0.06) {
  if (!ac || muted) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
const sfx = {
  examine: () => { blip(520, .1, 'sine'); blip(390, .2, 'sine'); },
  good: () => { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, .3, 'sine', .07), i * 110)); },
  bad: () => { blip(70, .5, 'sawtooth', .12); blip(90, .4, 'square', .08); },
  type: () => blip(900 + Math.random() * 300, .02, 'square', .015)
};
function heartbeat() { blip(55, .12, 'sine', .15); setTimeout(() => blip(50, .14, 'sine', .12), 160); }
function speak(text) {
  if (!voiceOn || muted || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text); u.pitch = 0.4; u.rate = 0.8; speechSynthesis.cancel(); speechSynthesis.speak(u);
}

// ---------- UI ----------
function toast(text, color = '#39ff88') {
  const el = $('toast'); el.textContent = text; el.style.color = color; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200);
}
const fmt = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

function renderLog() {
  const log = $('log');
  const entries = state.log;
  const last = entries[entries.length - 1];
  const key = `${entries.length}|${last ? last.speaker + last.text : ''}`;
  if (key === lastLogKey) return;
  lastLogKey = key;
  log.replaceChildren();
  entries.forEach((e, i) => {
    const p = document.createElement('p'); p.className = e.speaker;
    const prefix = e.speaker === 'ghost' ? 'WREN> ' : e.speaker === 'player' ? 'YOU> ' : '';
    p.textContent = prefix + e.text; log.appendChild(p);
  });
  if (last && last.speaker === 'ghost') speak(last.text);
  log.scrollTop = log.scrollHeight;
}

function renderPanel() {
  const clues = $('clues'); clues.replaceChildren();
  if (!state.clues.length) { const em = document.createElement('em'); em.textContent = 'Click objects in the room.'; clues.appendChild(em); }
  for (const c of state.clues) {
    const d = document.createElement('div'); d.className = 'clue' + (selectedClue === c.id ? ' sel' : '');
    d.textContent = `${c.title}: ${c.summary}`;
    d.onclick = () => { selectedClue = selectedClue === c.id ? null : c.id; renderPanel(); };
    clues.appendChild(d);
  }
  const claims = $('claims'); claims.replaceChildren();
  for (const c of state.claims) {
    const d = document.createElement('div'); d.className = 'claim' + (c.resolved ? ' done' : '');
    d.textContent = c.text;
    if (!c.resolved) {
      const b = document.createElement('button'); b.textContent = 'CONFRONT'; b.disabled = !selectedClue;
      b.onclick = () => confront(c.id); d.appendChild(document.createElement('br')); d.appendChild(b);
    }
    claims.appendChild(d);
  }
}

function render() {
  $('timer').textContent = fmt(state.remainingMs);
  $('timer').classList.toggle('low', state.remainingMs < 60000);
  $('trust').textContent = '■'.repeat(state.trust) || '–';
  $('rage').textContent = '■'.repeat(state.anger) + '□'.repeat(state.maxAnger - state.anger);
  renderLog(); renderPanel();
  if (state.phase === 'ended' && $('ending').classList.contains('hidden')) showEnding();
}

function showEnding() {
  const e = state.ending;
  $('ending-title').textContent = e.title; $('ending-title').dataset.text = e.title;
  $('ending-text').textContent = e.text;
  $('ending-stats').textContent = `Clues ${e.stats.clues}/6 · Lies exposed ${e.stats.contradictions}/3 · Mistakes ${e.stats.mistakes}`;
  $('ending').classList.remove('hidden');
  ['hud', 'panel', 'dialogue'].forEach((i) => $(i).classList.add('hidden'));
  (e.tone === 'good' ? sfx.good : sfx.bad)();
  glitch = e.tone === 'good' ? 0 : 2;
}

function apply(res) {
  if (res.state) state = res.state;
  if (state) render();
}

// ---------- Actions ----------
async function begin() {
  initAudio();
  const provider = $('provider').value;
  if (provider) await api('/api/config', 'POST', { provider, model: $('model').value.trim() || undefined });
  const r = await api('/api/new', 'POST'); sid = r.sid; state = r.state; lastLogKey = ''; selectedClue = null;
  apply(await api('/api/start', 'POST'));
  $('title').classList.add('hidden'); $('ending').classList.add('hidden');
  ['hud', 'panel', 'dialogue'].forEach((i) => $(i).classList.remove('hidden'));
  toast('SIGNAL ACQUIRED');
}

async function examine(id) {
  if (!state || state.phase !== 'playing') return;
  const r = await api('/api/examine', 'POST', { id });
  if (r.result?.first) { sfx.examine(); flash = 0.4; toast(r.result.text.slice(0, 60) + '…'); }
  apply(r);
}

async function confront(claim) {
  const r = await api('/api/present', 'POST', { clue: selectedClue, claim });
  if (r.result?.correct) { sfx.good(); toast('LIE EXPOSED', '#7fd6ff'); flash = 1; }
  else if (r.result) { sfx.bad(); glitch = 1.5; toast('WRONG', '#ff3355'); }
  selectedClue = null; apply(r);
}

let armed = null;
async function decide(choice) {
  const btn = $(choice === 'release' ? 'btn-release' : 'btn-contain');
  if (armed !== choice) {
    disarm(); armed = choice; btn.textContent = 'CONFIRM? FINAL';
    armed_t = setTimeout(disarm, 3500);
    return;
  }
  disarm();
  apply(await api('/api/decide', 'POST', { choice }));
}
let armed_t;
function disarm() { clearTimeout(armed_t); armed = null; $('btn-release').textContent = 'RELEASE'; $('btn-contain').textContent = 'CONTAIN'; }

$('chat').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const input = $('chat-input'); const message = input.value.trim(); if (!message) return;
  input.value = ''; input.disabled = true; input.placeholder = 'WREN is listening...';
  const r = await api('/api/chat', 'POST', { message });
  input.disabled = false; input.placeholder = 'Speak to the ghost...'; input.focus();
  if (r.result?.reply) { for (let i = 0; i < 3; i++) setTimeout(sfx.type, i * 60); glitch = Math.max(glitch, 0.4); }
  apply(r);
});

$('btn-start').onclick = begin;
$('btn-again').onclick = () => { $('ending').classList.add('hidden'); $('title').classList.remove('hidden'); };
$('btn-release').onclick = () => decide('release');
$('btn-contain').onclick = () => decide('contain');

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  if (e.key === 'm' || e.key === 'M') { muted = !muted; if (drone) drone.frequency.value = muted ? 0 : 43; }
  if (e.key === 'v' || e.key === 'V') { voiceOn = !voiceOn; toast(voiceOn ? 'VOICE ON' : 'VOICE OFF'); }
});

// ---------- Providers ----------
async function loadProviders() {
  const sel = $('provider'); const st = $('provider-status');
  try {
    const r = await api('/api/providers');
    sel.replaceChildren();
    for (const p of r.providers) {
      const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.online ? '● ' : '○ '}${p.label}`;
      sel.appendChild(o);
    }
    sel.value = r.current.provider;
    const update = () => {
      const p = r.providers.find((x) => x.id === sel.value);
      $('model').placeholder = p.defaultModel;
      st.textContent = p.id === 'scripted' ? 'Offline mode: always available.' : p.online ? `Detected. Models: ${p.models.slice(0, 4).join(', ') || 'n/a'}` : 'Not detected - will fall back to the scripted ghost.';
    };
    sel.onchange = update; update();
  } catch { st.textContent = 'Server unreachable.'; }
}

// ---------- Hardware stream ----------
try {
  const es = new EventSource('/api/stream');
  es.onmessage = async (m) => {
    const e = JSON.parse(m.data);
    if (e.type === 'ambient') { glitch = 1; if (e.name === 'light' && e.value < 0.2) flash = -1; return; }
    if (sid && state?.phase === 'playing') apply(await api('/api/state'));
  };
} catch { /* optional */ }

// ---------- Rendering ----------
function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; }
addEventListener('resize', resize); resize();
canvas.addEventListener('mousemove', (e) => { mouse = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; });
canvas.addEventListener('click', (e) => {
  if (!state || state.phase !== 'playing') return;
  const x = e.clientX / innerWidth, y = e.clientY / innerHeight;
  for (const [id, [sx, sy]] of Object.entries(SPOTS)) if (Math.hypot((x - sx) * innerWidth, (y - sy) * innerHeight) < 55) return examine(id);
});

const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 0.0004 + 0.0001, r: Math.random() * 2 + 0.5 }));

function drawGhost(w, h, mood) {
  const color = MOODS[mood] || MOODS.guarded;
  const cx = w * 0.35, cy = h * 0.4, s = Math.min(w, h) * 0.2;
  const bob = Math.sin(t * 1.2) * 8;
  ctx.save(); ctx.translate(cx, cy + bob);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6);
  g.addColorStop(0, color + '55'); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.fillRect(-s * 2, -s * 2, s * 4, s * 4);
  ctx.globalAlpha = 0.75; ctx.fillStyle = color + '33'; ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-s * .6, s * 1.1);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-s * .6 + i * s * .2, s * 1.1 + (i % 2 ? 0.25 : -0.05) * s + Math.sin(t * 3 + i) * 6);
  ctx.lineTo(s * .6, 0); ctx.bezierCurveTo(s * .6, -s * .9, -s * .6, -s * .9, -s * .6, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1; ctx.fillStyle = '#000';
  const blink = Math.sin(t * 0.7) > 0.97 ? 0.1 : 1;
  const ex = mood === 'angry' ? s * 0.22 : s * 0.16;
  [-1, 1].forEach((d) => { ctx.beginPath(); ctx.ellipse(d * s * .24, -s * .25, ex, ex * 1.5 * blink, 0, 0, 7); ctx.fill(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(d * s * .24 + (mouse.x - 0.35) * 14, -s * .25, 3, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; });
  ctx.beginPath();
  const open = mood === 'angry' ? 0.3 : mood === 'afraid' ? 0.18 : 0.05;
  ctx.ellipse(0, s * .25, s * .18, s * (open + Math.abs(Math.sin(t * 2)) * 0.04), 0, 0, 7); ctx.fill();
  ctx.restore();
}

function drawSpot(id, x, y, examined, hover) {
  ctx.save(); ctx.translate(x, y);
  const pulse = 0.6 + Math.sin(t * 3 + x) * 0.3;
  ctx.strokeStyle = examined ? '#1f6b43' : '#39ff88'; ctx.fillStyle = examined ? '#0b1a12' : '#0d2d1a';
  ctx.lineWidth = hover ? 3 : 1.5; ctx.shadowColor = '#39ff88'; ctx.shadowBlur = examined ? 0 : 14 * pulse;
  ctx.beginPath();
  if (id === 'terminal' || id === 'notice') ctx.rect(-26, -20, 52, 40);
  else if (id === 'photo') ctx.rect(-20, -26, 40, 52);
  else if (id === 'badge') ctx.roundRect(-18, -24, 36, 48, 6);
  else if (id === 'musicbox') ctx.rect(-26, -14, 52, 28);
  else ctx.arc(0, 0, 24, 0, 7);
  ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = ctx.strokeStyle; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText(examined ? '✓' : '?', 0, 4);
  ctx.restore();
}

function frame(ts) {
  const dt = Math.min(0.1, ts / 1000 - t); t = ts / 1000;
  const w = canvas.width / devicePixelRatio, h = canvas.height / devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const mood = state?.mood || 'guarded';
  ctx.fillStyle = '#020604'; ctx.fillRect(0, 0, w, h);

  // room: perspective grid
  ctx.strokeStyle = '#0c2a1a'; ctx.lineWidth = 1;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 20, h * 0.35); ctx.lineTo(w / 2 + i * w * 0.12, h); ctx.stroke(); }
  for (let i = 0; i < 10; i++) { const y = h * 0.35 + (i * i / 81) * h * 0.65; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  for (const m of motes) { m.y -= m.s; if (m.y < 0) m.y = 1; ctx.fillStyle = 'rgba(120,255,180,.25)'; ctx.fillRect(m.x * w, m.y * h, m.r, m.r); }

  if (state && state.phase !== 'intro') {
    drawGhost(w, h, mood);
    for (const o of state.objects) {
      const [sx, sy] = SPOTS[o.id]; const x = sx * w, y = sy * h;
      const hover = Math.hypot(mouse.x * w - x, mouse.y * h - y) < 55;
      drawSpot(o.id, x, y, o.examined, hover);
      if (hover) { ctx.fillStyle = '#39ff88'; ctx.font = '13px monospace'; ctx.textAlign = 'center'; ctx.fillText(o.label, x, y + 44); }
    }
    canvas.style.cursor = 'default';
    if (state.phase === 'playing') {
      const lowTime = state.remainingMs < 60000;
      if (lowTime && ts - beatAt > 900) { beatAt = ts; heartbeat(); }
      state.remainingMs -= dt * 1000; // smooth local countdown, resynced on server responses
      if (state.remainingMs < 0) state.remainingMs = 0;
      $('timer').textContent = fmt(state.remainingMs); $('timer').classList.toggle('low', lowTime);
      if (state.remainingMs === 0 && !frame.sent) { frame.sent = true; api('/api/state').then((r) => { frame.sent = false; apply(r); }); }
    }
  }

  // glitch slices
  const g = glitch + (mood === 'angry' ? 0.4 : 0) + (Math.random() < 0.003 ? 1 : 0);
  if (g > 0.05) {
    for (let i = 0; i < 3 + g * 5; i++) {
      const y = Math.random() * h, sh = 4 + Math.random() * 30;
      try { ctx.drawImage(canvas, 0, y * devicePixelRatio, canvas.width, sh * devicePixelRatio, (Math.random() - 0.5) * 40 * g, y, w, sh); } catch { /* ignore */ }
    }
  }
  glitch *= 0.95;
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.35})`; ctx.fillRect(0, 0, w, h); flash *= 0.9; }
  else if (flash < 0) { ctx.fillStyle = `rgba(0,0,0,${-flash})`; ctx.fillRect(0, 0, w, h); flash *= 0.9; }

  requestAnimationFrame(frame);
}

// resync server clock periodically
setInterval(async () => { if (sid && state?.phase === 'playing') apply(await api('/api/state')); }, 5000);

loadProviders();
requestAnimationFrame(frame);
