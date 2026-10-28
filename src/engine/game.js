import { GAME_DURATION_MS, MAX_ANGER, OBJECTS, CLUES, CLAIMS, WRONG_REACTIONS, ENDINGS, INTRO, UNDERSTOOD_LINE } from './story.js';

// Deterministic game engine. No AI, no randomness, injectable clock.
export class Game {
  constructor({ now = () => Date.now(), durationMs = GAME_DURATION_MS, onEvent = () => {} } = {}) {
    this.now = now;
    this.durationMs = durationMs;
    this.onEvent = onEvent;
    this.phase = 'intro';
    this.startedAt = null;
    this.examined = new Set();
    this.clues = [];
    this.resolved = new Set();
    this.trust = 0;
    this.anger = 0;
    this.endingId = null;
    this.wrongCount = 0;
    this.log = [];
  }

  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  say(speaker, text) { this.log.push({ speaker, text }); if (this.log.length > 200) this.log.shift(); }

  start() {
    if (this.phase !== 'intro') return { ok: false, error: 'already started' };
    this.phase = 'playing';
    this.startedAt = this.now();
    for (const l of INTRO) this.say('system', l);
    this.say('ghost', 'Hello? ...Oh. You can see me. Please do not touch anything. I am only a maintenance process.');
    this.emit('start');
    return { ok: true };
  }

  remainingMs() {
    if (this.phase === 'intro') return this.durationMs;
    if (this.phase === 'ended') return Math.max(0, this.durationMs - ((this.endedAt ?? this.now()) - this.startedAt));
    return Math.max(0, this.durationMs - (this.now() - this.startedAt));
  }

  tick() {
    if (this.phase === 'playing' && this.remainingMs() <= 0) this.finish('blackout');
    return this.phase;
  }

  get truthKnown() { return this.resolved.size === CLAIMS.length; }
  get understood() { return this.examined.has('voicemail') && this.examined.has('notice'); }

  mood() {
    if (this.phase === 'ended') return this.endingId === 'peace' ? 'calm' : 'angry';
    if (this.anger >= 3) return 'angry';
    if (this.anger >= 1) return 'uneasy';
    if (this.truthKnown) return 'afraid';
    if (this.trust >= 2) return 'calm';
    return 'guarded';
  }

  examine(id) {
    if (!this.guard()) return { ok: false, error: 'not playing' };
    const obj = OBJECTS.find((o) => o.id === id);
    if (!obj) return { ok: false, error: 'unknown object' };
    const first = !this.examined.has(id);
    this.examined.add(id);
    if (first) {
      this.clues.push(obj.clue);
      this.say('system', `${obj.label}: ${obj.text}`);
      this.say('ghost', obj.whisper);
      this.emit('examine', { id });
    }
    return { ok: true, first, text: obj.text, whisper: obj.whisper };
  }

  present(clueId, claimId) {
    if (!this.guard()) return { ok: false, error: 'not playing' };
    if (!this.clues.includes(clueId)) return { ok: false, error: 'clue not found' };
    const claim = CLAIMS.find((c) => c.id === claimId);
    if (!claim) return { ok: false, error: 'unknown claim' };
    if (this.resolved.has(claimId)) return { ok: false, error: 'already resolved' };
    if (claim.refutedBy.includes(clueId)) {
      this.resolved.add(claimId);
      this.trust += 1;
      this.say('ghost', claim.reaction);
      this.emit('contradiction', { claim: claimId });
      return { ok: true, correct: true, reaction: claim.reaction };
    }
    this.anger += 1;
    this.wrongCount += 1;
    const reaction = WRONG_REACTIONS[Math.min(this.anger, WRONG_REACTIONS.length) - 1];
    this.say('ghost', reaction);
    this.emit('wrong', { anger: this.anger });
    if (this.anger >= MAX_ANGER) this.finish('blackout');
    return { ok: true, correct: false, reaction };
  }

  decide(choice) {
    if (!this.guard()) return { ok: false, error: 'not playing' };
    if (choice === 'release') return this.finish(this.truthKnown ? 'peace' : 'unleashed');
    if (choice === 'contain') return this.finish(this.truthKnown ? 'quiet_room' : 'static');
    return { ok: false, error: 'unknown choice' };
  }

  guard() { this.tick(); return this.phase === 'playing'; }

  finish(id) {
    this.phase = 'ended';
    this.endingId = id;
    this.endedAt = this.now();
    this.emit('ending', { ending: id });
    return { ok: true, ending: this.endingView() };
  }

  endingView() {
    if (!this.endingId) return null;
    const e = ENDINGS[this.endingId];
    const text = this.endingId === 'peace' && this.understood ? `${e.text} ${UNDERSTOOD_LINE}` : e.text;
    return { ...e, text, stats: { clues: this.clues.length, contradictions: this.resolved.size, mistakes: this.wrongCount } };
  }

  snapshot() {
    this.tick();
    return {
      phase: this.phase,
      remainingMs: this.remainingMs(),
      durationMs: this.durationMs,
      mood: this.mood(),
      trust: this.trust,
      anger: this.anger,
      maxAnger: MAX_ANGER,
      objects: OBJECTS.map((o) => ({ id: o.id, label: o.label, examined: this.examined.has(o.id) })),
      clues: this.clues.map((id) => CLUES[id]),
      claims: CLAIMS.map((c) => ({ id: c.id, text: c.text, resolved: this.resolved.has(c.id) })),
      log: this.log.slice(-60),
      ending: this.endingView()
    };
  }

  // Facts the AI layer may use. Never includes unresolved secrets.
  ghostContext() {
    return {
      mood: this.mood(),
      trust: this.trust,
      anger: this.anger,
      phase: this.phase,
      resolved: CLAIMS.filter((c) => this.resolved.has(c.id)).map((c) => c.id),
      clues: [...this.clues],
      truthKnown: this.truthKnown
    };
  }
}
