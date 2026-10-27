// Hardware abstraction. Outputs (game -> devices) are broadcast to subscribers
// (browser SSE, and any future Arduino UNO Q / Raspberry Pi / M5GO bridge).
// Inputs (devices -> game) go through `translateInput`, which only maps to a
// small whitelist of safe game actions.
//
// Output events: { type: 'start'|'examine'|'contradiction'|'wrong'|'ending'|'ambient', ... }
// Input events:  { type: 'button', id: '<object id>' }
//                { type: 'sensor', name: 'motion'|'light'|'proximity'|'temperature', value: number }

export class Bus {
  constructor() { this.subs = new Set(); }
  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  publish(evt) { for (const fn of this.subs) { try { fn(evt); } catch { /* ignore */ } } }
}

const SENSORS = new Set(['motion', 'light', 'proximity', 'temperature']);

export function translateInput(evt, validObjectIds) {
  if (!evt || typeof evt !== 'object') return null;
  if (evt.type === 'button' && validObjectIds.includes(evt.id)) return { action: 'examine', id: evt.id };
  if (evt.type === 'sensor' && SENSORS.has(evt.name) && Number.isFinite(Number(evt.value))) {
    return { action: 'ambient', name: evt.name, value: Number(evt.value) };
  }
  return null;
}
