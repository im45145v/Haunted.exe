// Pluggable LLM providers. All use only open-weight-friendly local servers by default.
// Config comes from env; the UI may only choose provider/model, never base URLs.

const TIMEOUT_MS = 20000;

async function postJson(url, body, headers = {}, timeout = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function getJson(url, headers = {}, timeout = 1500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export const PROVIDER_DEFS = {
  ollama: {
    label: 'Ollama (local, e.g. llama3.2, qwen2.5, gemma2)',
    baseUrl: 'http://127.0.0.1:11434', model: 'llama3.2',
    async available(cfg) { try { const j = await getJson(`${cfg.baseUrl}/api/tags`); return (j.models || []).map((m) => m.name); } catch { return null; } },
    async chat(cfg, messages) {
      const j = await postJson(`${cfg.baseUrl}/api/chat`, { model: cfg.model, messages, stream: false, options: { temperature: 0.8, num_predict: 140 } });
      return j?.message?.content;
    }
  },
  llamacpp: {
    label: 'llama.cpp server (OpenAI-compatible, local GGUF)',
    baseUrl: 'http://127.0.0.1:8080', model: 'local',
    async available(cfg) { try { await getJson(`${cfg.baseUrl}/v1/models`); return [cfg.model]; } catch { return null; } },
    chat: openAiChat
  },
  lmstudio: {
    label: 'LM Studio (OpenAI-compatible, local)',
    baseUrl: 'http://127.0.0.1:1234', model: 'local-model',
    async available(cfg) { try { const j = await getJson(`${cfg.baseUrl}/v1/models`); return (j.data || []).map((m) => m.id); } catch { return null; } },
    chat: openAiChat
  },
  openai: {
    label: 'Custom OpenAI-compatible endpoint (vLLM, Groq, OpenRouter...)',
    baseUrl: 'http://127.0.0.1:8000', model: 'open-model',
    async available(cfg) { try { const j = await getJson(`${cfg.baseUrl}/v1/models`, authHeader(cfg)); return (j.data || []).map((m) => m.id); } catch { return null; } },
    chat: openAiChat
  },
  scripted: {
    label: 'Offline scripted ghost (no model needed)',
    baseUrl: '', model: 'scripted',
    async available() { return ['scripted']; },
    async chat() { throw new Error('scripted'); }
  }
};

function authHeader(cfg) { return cfg.apiKey ? { authorization: 'Bearer ' + cfg.apiKey } : {}; }

async function openAiChat(cfg, messages) {
  const j = await postJson(`${cfg.baseUrl}/v1/chat/completions`, { model: cfg.model, messages, temperature: 0.8, max_tokens: 140 }, authHeader(cfg));
  return j?.choices?.[0]?.message?.content;
}

export function loadConfig(env = process.env) {
  const provider = PROVIDER_DEFS[env.HAUNTED_PROVIDER] ? env.HAUNTED_PROVIDER : 'scripted';
  return configFor(provider, env);
}

export function configFor(provider, env = process.env, model) {
  const def = PROVIDER_DEFS[provider];
  const explicit = env.HAUNTED_PROVIDER === provider;
  return {
    provider,
    baseUrl: (explicit && env.HAUNTED_BASE_URL) || env[`HAUNTED_${provider.toUpperCase()}_URL`] || def.baseUrl,
    model: model || (explicit && env.HAUNTED_MODEL) || def.model,
    apiKey: env.HAUNTED_API_KEY || ''
  };
}

export async function listProviders(env = process.env) {
  const out = [];
  for (const [id, def] of Object.entries(PROVIDER_DEFS)) {
    const cfg = configFor(id, env);
    const models = await def.available(cfg);
    out.push({ id, label: def.label, online: !!models, models: models || [], defaultModel: cfg.model });
  }
  return out;
}
