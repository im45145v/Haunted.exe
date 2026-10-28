import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';

function make() { let t = 0; const g = new Game({ now: () => t }); return { g, advance: (ms) => { t += ms; } }; }
function solve(g) {
  g.start();
  for (const id of ['photo', 'badge', 'terminal']) g.examine(id);
  g.present('photo', 'c_nobody'); g.present('badge_log', 'c_alone'); g.present('lock_log', 'c_doors');
}

test('examine grants clue once', () => {
  const { g } = make(); g.start();
  assert.equal(g.examine('photo').first, true);
  assert.equal(g.examine('photo').first, false);
  assert.deepEqual(g.clues, ['photo']);
  assert.equal(g.examine('nope').ok, false);
});

test('actions rejected before start', () => {
  const { g } = make();
  assert.equal(g.examine('photo').ok, false);
  assert.equal(g.decide('release').ok, false);
});

test('correct contradiction resolves claim and raises trust', () => {
  const { g } = make(); g.start(); g.examine('badge');
  const r = g.present('badge_log', 'c_alone');
  assert.equal(r.correct, true); assert.equal(g.trust, 1);
  assert.equal(g.present('badge_log', 'c_alone').ok, false);
});

test('cannot present unfound clue', () => {
  const { g } = make(); g.start();
  assert.equal(g.present('badge_log', 'c_alone').ok, false);
});

test('wrong evidence raises anger; four mistakes cause blackout', () => {
  const { g } = make(); g.start();
  for (const id of ['photo', 'badge', 'terminal', 'notice']) g.examine(id);
  g.present('shutdown', 'c_alone');
  g.present('shutdown', 'c_doors'); g.present('shutdown', 'c_nobody');
  assert.equal(g.phase, 'playing'); assert.equal(g.mood(), 'angry');
  g.present('badge_log', 'c_doors');
  assert.equal(g.phase, 'ended'); assert.equal(g.endingId, 'blackout');
});

test('release/contain endings depend on truth', () => {
  let a = make().g; a.start(); a.decide('release'); assert.equal(a.endingId, 'unleashed');
  a = make().g; a.start(); a.decide('contain'); assert.equal(a.endingId, 'static');
  a = make().g; solve(a); a.decide('release'); assert.equal(a.endingId, 'peace');
  a = make().g; solve(a); a.decide('contain'); assert.equal(a.endingId, 'quiet_room');
});

test('understood epilogue only with voicemail and notice', () => {
  const { g } = make(); solve(g); g.examine('voicemail'); g.examine('notice'); g.decide('release');
  assert.match(g.endingView().text, /understood/);
});

test('timer expiry ends with blackout', () => {
  const { g, advance } = make(); g.start();
  advance(299000); assert.equal(g.snapshot().phase, 'playing');
  advance(2000); assert.equal(g.snapshot().phase, 'ended'); assert.equal(g.endingId, 'blackout');
  assert.equal(g.examine('photo').ok, false);
});

test('ghost context hides unresolved claims as unresolved', () => {
  const { g } = make(); g.start(); g.examine('badge'); g.present('badge_log', 'c_alone');
  assert.deepEqual(g.ghostContext().resolved, ['c_alone']);
});
