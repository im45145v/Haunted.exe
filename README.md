# HAUNTED.EXE
An AI-powered interactive horror experience for Hacktoberfest 2026: *Ghost in the Machine*.

A ghost is trapped inside an old lab computer. It calls itself a "maintenance process" and it is lying. Explore the room, collect evidence, expose its contradictions, talk to it, and decide: **RELEASE** or **CONTAIN**. You have five minutes.

## Quick start
Requires Node.js 18+. There are no dependencies.

```bash
npm start            # http://127.0.0.1:3000
npm test
```
Open the page, press **F** for fullscreen (projector mode), choose a ghost mind, click **BOOT**.
The game is fully playable with **no model configured** (offline scripted ghost).

## How to play
- Click glowing objects in the room to collect 6 clues.
- The ghost tells 3 lies (right panel). Select a clue, then **CONFRONT** the lie it refutes.
- Wrong evidence raises her RAGE; at 4 the power dies. Correct evidence raises TRUST.
- RELEASE or CONTAIN at any time; the ending depends on whether you uncovered all 3 lies.
- Timer expiry also ends the game.

Endings: `LET GO` (release with truth), `UNLEASHED` (release blind), `THE QUIET ROOM` (contain with truth), `STATIC` (contain blind), `BLACKOUT` (time out or rage).

Keys: `F` fullscreen, `M` mute, `V` spoken ghost voice (browser speech synthesis).

## AI providers (open-weight, local first)
The ghost's *free-form chat* is the only AI-driven part. Choose a provider on the title screen or via env vars:

| Provider | `HAUNTED_PROVIDER` | Default URL |
|---|---|---|
| Offline scripted ghost | `scripted` (default) | - |
| Ollama (llama3.2, qwen2.5, gemma2...) | `ollama` | `http://127.0.0.1:11434` |
| llama.cpp `llama-server` (GGUF) | `llamacpp` | `http://127.0.0.1:8080` |
| LM Studio | `lmstudio` | `http://127.0.0.1:1234` |
| Any OpenAI-compatible (vLLM, etc.) | `openai` | `http://127.0.0.1:8000` |

Env: `HAUNTED_PROVIDER`, `HAUNTED_MODEL`, `HAUNTED_BASE_URL` (or `HAUNTED_<PROVIDER>_URL`), `HAUNTED_API_KEY`, `PORT`, `HOST`.
Example: `ollama pull llama3.2 && HAUNTED_PROVIDER=ollama npm start`.

Any provider error or timeout (20 s) silently falls back to the scripted ghost. Base URLs are only settable by env, never from the browser.

## Architecture
```
src/engine/   deterministic puzzle logic (story data, state machine, endings). No AI, no randomness.
src/ai/       persona prompt, providers, scripted fallback, ghost orchestrator. Read-only view of game state.
src/hardware/ event bus + whitelisted input translation (Arduino UNO Q / RPi 4 / M5GO / sensors).
src/server.js zero-dependency HTTP API + static server (+ SSE stream /api/stream).
public/       canvas visuals, WebAudio, UI.
test/         node:test suites (engine, AI, HTTP).
```
The AI can only produce dialogue text. It can't grant clues, change trust/anger, or pick endings, and its prompt only contains facts the ghost may admit.

## Hardware integration (future-ready)
Outbound: subscribe to `GET /api/stream` (SSE) for `start`, `examine`, `contradiction`, `wrong`, `ending`, `ambient` events, e.g. to drive M5GO lights or a relay.
Inbound: `POST /api/hardware/event` with header `x-session: <sid>`:
```json
{"type":"button","id":"musicbox"}
{"type":"sensor","name":"motion","value":1}
```
Buttons map to object ids (`terminal badge photo musicbox voicemail notice`); sensors trigger ambient glitches. The server binds to `127.0.0.1` by default; set `HOST=0.0.0.0` on a trusted network to let a Pi/Arduino bridge connect.

## Limitations
- Sessions are in memory (lost on restart); the ghost provider setting is shared by all sessions.
- Spoken voice uses the browser's speech synthesis (quality varies); audio is procedural.
- Hardware adapters are interfaces only; no device firmware is included.
- LLM output quality depends on the chosen model; small models may occasionally break character.
