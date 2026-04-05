# Pipecat Voice Pipeline — Design Document

**Date:** 2026-04-05
**Status:** Proposed

## Problem

vMira's voice mode uses client-side amplitude detection for VAD, resulting in:
- Echo triggers (AI hears itself)
- False interrupts from ambient noise
- Messages cut off mid-sentence
- ~2-4s end-to-end latency (3 network hops per turn)
- No streaming TTS overlap (waits for sentence boundaries)

## Solution

Deploy **Pipecat** on the GPU server (Vast.ai Instance 2) as a server-side voice pipeline. The browser connects via WebSocket, and all audio processing happens on the GPU server with direct localhost access to the LLM.

## Architecture

```
Browser (mic/speaker)
  ↕ WebSocket (audio frames)
GPU Server (Pipecat pipeline):
  → Silero VAD (voice activity detection, <1ms per 30ms chunk)
  → faster-whisper STT (already running, CUDA, ~200ms)
  → LLM (localhost:8080, sova-v1.0, zero network hop)
  → ElevenLabs TTS (streaming, ~150ms TTFB)
  ← Audio frames back to browser
```

### Why WebSocket (not WebRTC)

- The GPU server is on Vast.ai behind SSH port forwarding — no stable public IP for STUN/TURN
- WebSocket tunnels cleanly through the existing Aeza→Vast SSH tunnel
- Pipecat supports `FastAPIWebsocketTransport` natively
- Latency difference is ~20-50ms vs WebRTC — acceptable for our use case

### Component Mapping

| Current | Replacement | Location |
|---------|-------------|----------|
| Browser SpeechRecognition | Silero VAD + faster-whisper | GPU server |
| Browser amplitude threshold | Silero VAD (AI-based) | GPU server |
| Browser echo cooldown (600ms) | Not needed (server-side, no speaker feedback) | Eliminated |
| Rust /voice/transcribe endpoint | Pipecat STT processor | GPU server |
| Rust /voice/synthesize endpoint | Pipecat TTS processor (ElevenLabs) | GPU server |
| Rust /chat/.../messages SSE | Pipecat LLM processor (localhost:8080) | GPU server |
| Browser sentence-boundary TTS | Pipecat streaming TTS (token-level) | GPU server |

### What Stays

- **Regular text chat** — unchanged, still uses Rust backend SSE
- **ElevenLabs as TTS provider** — same voices, same API key, but called from GPU server
- **faster-whisper** — already installed on GPU, just used through Pipecat instead of Flask
- **LLM (sova-v1.0)** — unchanged, Pipecat calls it via OpenAI-compatible API at localhost:8080
- **Browser VoiceMode.tsx** — simplified to just WebSocket audio streaming + UI

### What Gets Replaced

- `voice-server.py` (Flask STT/TTS) → Pipecat pipeline
- Client-side VAD/silence detection → Silero VAD server-side
- Client-side sentence-boundary TTS queueing → Pipecat streaming TTS
- `useStreamingText` for voice → direct audio stream

## GPU Server Changes

### New files in datacenter repo:
```
datacenter/
  voice-pipeline/
    pipeline.py          # Pipecat pipeline definition
    requirements.txt     # pipecat-ai[silero,websocket], faster-whisper, etc.
    Dockerfile           # Python 3.11 + CUDA + Pipecat
  docker-compose.gpu.yml # Updated: add voice-pipeline service
```

### Pipeline definition (pipeline.py):
```
Transport(FastAPIWebsocket)
  → SileroVADAnalyzer (confidence=0.6, stop_secs=1.5)
  → FasterWhisperSTT (model=base, device=cuda)
  → OpenAILLM (base_url=http://localhost:8080/v1, model=sova-v1.0)
  → ElevenLabsTTS (voice=Rachel/Anna/Laura, model=eleven_flash_v2_5)
  → Transport output
```

### Networking:
- Pipecat listens on port **8095** (WebSocket)
- SSH tunnel added: `Aeza:9095 → GPU:8095`
- Rust backend proxies `/api/v1/voice/ws` → `localhost:9095`
- Or: frontend connects directly to Aeza:9095 via ws://

## Frontend Changes

### VoiceMode.tsx — Simplified:
```
Connect WebSocket to /api/v1/voice/ws
  → Stream mic audio (PCM 16-bit, 16kHz)
  ← Receive audio frames (PCM or opus)
  ← Receive text events (transcript, response)
UI only: canvas animation, phase display, mute button, timer
No more: silence detection, sentence boundary, TTS queueing, echo cooldown
```

### What's removed from VoiceMode.tsx:
- All silence/amplitude detection code (~100 lines)
- All TTS queueing and playback logic (~150 lines)  
- All MediaRecorder/SpeechRecognition code (~80 lines)
- Echo cooldown logic

### What's added:
- WebSocket connection to voice pipeline
- PCM audio capture via AudioWorklet (reliable, low-latency)
- Audio playback via AudioContext (already implemented)
- Event handling: transcript, response text, phase changes

## Rust Backend Changes

### Option A: WebSocket proxy (minimal)
Add a WebSocket endpoint that proxies to the Pipecat server:
```rust
// routes/voice.rs
async fn voice_ws(ws: WebSocketUpgrade, AuthUser(user): AuthUser) -> Response {
    // Authenticate, then proxy WebSocket to localhost:9095
}
```

### Option B: Direct tunnel (simpler)
Expose the Pipecat WebSocket directly through Aeza nginx on a subpath. No Rust changes needed.

**Recommendation:** Option A — keeps auth consistent and doesn't expose raw Pipecat to the internet.

## Rollout Plan

1. **Phase 1: Deploy Pipecat on GPU** — pipeline.py, Docker, test standalone
2. **Phase 2: Add WebSocket proxy to Rust backend** — auth + tunnel
3. **Phase 3: Rewrite VoiceMode.tsx** — WebSocket client, simplified UI
4. **Phase 4: Add SSH tunnel** — Aeza:9095 → GPU:8095
5. **Phase 5: Test end-to-end** — latency, echo, interruption, multilingual
6. **Phase 6: Remove old voice endpoints** — /transcribe, /synthesize Flask server

## Expected Improvements

| Metric | Current | After Pipecat |
|--------|---------|---------------|
| End-to-end latency | ~2-4s | ~800ms-1.2s |
| VAD quality | Amplitude threshold (noisy) | Silero AI model (robust) |
| Echo cancellation | Browser AEC + 600ms cooldown | Not needed (server-side) |
| Turn detection | Fixed 2.5s timeout | Smart silence + VAD confidence |
| TTS streaming | Sentence-boundary batched | Token-level streaming |
| Interruption | Amplitude threshold (echo-prone) | VAD-based (clean) |
| iOS support | Partial (workarounds) | Full (WebSocket + AudioWorklet) |

## Cost Impact

- **Pipecat itself:** Free (BSD-2 license)
- **Silero VAD:** Free (MIT license, runs on CPU)
- **faster-whisper:** Free (already deployed)
- **ElevenLabs:** Same cost as current (~$0.002/response)
- **GPU server:** No additional cost (spare CPU/RAM on existing instance)
- **Total additional cost:** $0/month
