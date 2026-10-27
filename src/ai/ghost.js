import { PROVIDER_DEFS, configFor, loadConfig } from './providers.js';
import { buildSystemPrompt, sanitizeReply } from './persona.js';
import { scriptedReply } from './scripted.js';

// Ghost dialogue orchestrator. Falls back to the scripted ghost on any failure,
// so the game is always playable. Never mutates game state.
export class GhostVoice {
  constructor(env = process.env) {
    this.env = env;
    this.config = loadConfig(env);
    this.lastError = null;
  }

  setProvider(provider, model) {
    if (!PROVIDER_DEFS[provider]) return false;
    this.config = configFor(provider, this.env, typeof model === 'string' && model.length < 100 ? model : undefined);
    this.lastError = null;
    return true;
  }

  status() { return { provider: this.config.provider, model: this.config.model, lastError: this.lastError }; }

  async reply(message, ctx, history = []) {
    const def = PROVIDER_DEFS[this.config.provider];
    if (this.config.provider !== 'scripted') {
      try {
        const messages = [
          { role: 'system', content: buildSystemPrompt(ctx) },
          ...history.slice(-8),
          { role: 'user', content: message }
        ];
        const text = sanitizeReply(await def.chat(this.config, messages));
        if (text) { this.lastError = null; return { text, source: this.config.provider }; }
        throw new Error('empty reply');
      } catch (e) {
        this.lastError = String(e?.message || e);
      }
    }
    return { text: scriptedReply(message, ctx), source: 'scripted' };
  }
}
