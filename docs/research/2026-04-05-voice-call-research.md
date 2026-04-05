# Voice Call Mode — Industry Research (April 2026)

## How vMira Voice Works Today

**Architecture:** Browser SpeechRecognition (STT) → Rust backend (LLM) → ElevenLabs/Silero (TTS) → Web Audio API playback

**Turn detection:** Client-side silence detection via AudioContext analyser (amplitude threshold + timeout)

**Interruption:** Client-side amplitude threshold during "speaking" phase → stops audio, resumes listening

**Echo cancellation:** Browser `getUserMedia({ echoCancellation: true })` + 600ms post-TTS cooldown

**Latency:** ~2-4s end-to-end (SpeechRecognition ~500ms + LLM streaming ~1-2s + ElevenLabs TTS ~300ms + playback start)

---

## 1. OpenAI Realtime API

### Architecture
Stateful, event-based protocol for bidirectional audio/text streaming with a multimodal model. Three transports:
- **WebRTC** — recommended for browsers. Built-in Opus codec, AEC, bandwidth estimation
- **WebSocket** — server-to-server. Base64-encoded PCM chunks
- **SIP** — direct phone network integration (added at GA, Aug 2025)

Audio format: 16-bit PCM, 24kHz, mono. WebRTC uses Opus automatically.

### How It Differs From vMira
OpenAI's model (gpt-realtime) processes **audio tokens natively** — no separate STT/TTS step. Audio-in → model reasoning → audio-out in a single inference pass. Can detect tone, emotion, non-verbal cues.

### Turn Detection (VAD)
Three modes:
- **Server VAD** (default): Silence-based. Configurable `threshold` (0.0-1.0), `silence_duration_ms` (default 500ms), `prefix_padding_ms`
- **Semantic VAD**: AI model estimates whether user has finished speaking. Dynamically adjusts timeout. Much fewer false interruptions
- **Manual mode**: Client commits audio and triggers responses explicitly

### Interruption
When VAD detects user speech during model output:
1. `conversation.interrupted` event sent
2. Response cancelled
3. `conversation.item.truncated` synchronizes context with what user actually heard
4. New response generated from user's input

Can be configured: `interrupt_response: false` keeps VAD active but prevents auto-interruption.

### Echo Cancellation
- **WebRTC:** Relies on browser AEC (Chrome/Safari good, Firefox problematic)
- **WebSocket:** No built-in AEC — must implement your own
- **Known issue:** Model can "talk to itself" via speaker→mic feedback

### Pricing (gpt-realtime, GA Aug 2025)
| | Per 1M tokens | Per minute (approx) |
|---|---|---|
| Audio input | $32.00 | ~$0.06 |
| Audio output | $64.00 | ~$0.24 |
| **Per minute total** | — | **~$0.30** |

gpt-realtime-mini: ~$0.10/minute

System prompts retransmitted every turn — a 1,000-word prompt can push costs from $0.16/min to $1.63/min.

### Latency
- Target: ~500ms TTFB, ~800ms voice-to-voice
- Measured (Jan 2025): ~1.7s end-to-end
- Longer sessions: can stretch to 5-6s as context grows

### GitHub Examples
- [openai/openai-realtime-agents](https://github.com/openai/openai-realtime-agents) — Next.js agentic voice patterns
- [openai/openai-realtime-console](https://github.com/openai/openai-realtime-console) — React debugging app
- [openai/openai-realtime-api-beta](https://github.com/openai/openai-realtime-api-beta) — Node.js reference client

### Limitations
- Max session: 60 minutes
- Context: 32,768 tokens
- Cannot resume previous sessions
- Transcription lags output by seconds
- Audio-transcript mismatches
- Voice cannot change mid-session

---

## 2. Claude (Anthropic)

### Architecture
Classic **STT → Text LLM → TTS pipeline**. Claude models are text/image only — no native audio modality.

### How It Differs From vMira
Very similar architecture to vMira. Claude has no audio API — developers build voice interfaces by chaining external STT + Claude API + external TTS.

### Mobile App
- Voice input: tap microphone to dictate (platform-native STT)
- Voice output: "read aloud" button (platform-native TTS)
- NOT continuous conversation — turn-by-turn only
- No interruption/barge-in

### No Realtime API
Anthropic has no audio/realtime API. The Messages API accepts text and images only. Streaming text via SSE is the closest analog.

### Latency (STT → Claude → TTS pipeline)
| Stage | Typical |
|---|---|
| STT (Whisper/Deepgram) | 200-800ms |
| Claude API (first token) | 300-1500ms |
| TTS (ElevenLabs streaming) | 200-500ms |
| **Total** | **700ms - 2800ms** |

Claude Haiku is recommended for voice due to lower latency (~300-500ms TTFB).

---

## 3. Open Source Frameworks

### Pipecat (Daily.co) — ⭐ 11k
**GitHub:** https://github.com/pipecat-ai/pipecat
**License:** BSD-2-Clause

**Architecture:** Composable pipeline of frame processors. STT→LLM→TTS + native S2S model support.

**VAD:** Silero VAD + **Smart Turn Model** (open-source audio transformer that analyzes whether user has finished their thought — reduces false positives significantly).

**Interruption:** Default on. Bot halts output, clears pending audio/text, ready for new input. Synchronizes TTS output with actual playback to prevent phantom interruptions.

**Echo cancellation:** Via transport (Daily WebRTC, Krisp, Koala, ai-coustics, RNNoise).

**Providers:** 17+ STT, 25+ TTS, 21+ LLM providers. Client SDKs for JS, React, React Native, Swift, Kotlin, C++.

**Latency:** 500-800ms typical. Sub-1s with optimized stack (Groq + Deepgram + Cartesia).

---

### LiveKit Agents — ⭐ 9.9k
**GitHub:** https://github.com/livekit/agents
**License:** Apache-2.0

**Architecture:** STT→LLM→TTS + S2S. Agents join LiveKit room as WebRTC participants.

**VAD:** Silero VAD + **semantic turn detection** (transformer model analyzes if user finished).

**Interruption:** **Adaptive Interruption Handling** — a dedicated model distinguishes true interruptions from backchanneling ("uh-huh", "okay"). Configurable `aec_warmup_duration` ignores interruptions for N seconds after agent starts speaking.

**Echo cancellation:** AEC warmup + Krisp integration (runs locally, no data sent to Krisp).

**Latency:** ~1.3s typical, sub-1s optimized, sub-500ms with realtime models.

---

### Moshi (Kyutai) — ⭐ 10k
**GitHub:** https://github.com/kyutai-labs/moshi
**License:** Apache-2.0

**Architecture:** True **native speech-to-speech, full-duplex**. Dual-stream processes user audio and system audio in parallel. No separate STT/TTS.

**Turn detection:** Inherent — full-duplex architecture handles overlapping speech naturally.

**Interruption:** Inherent — can stop speaking and start listening seamlessly.

**Latency:** **160-200ms** on L4 GPU. Dramatically lower than any STT→LLM→TTS pipeline.

**Limitation:** 7B model has less sophisticated language capabilities than large LLMs.

---

### Ultravox (Fixie AI) — ⭐ 4.4k
**GitHub:** https://github.com/fixie-ai/ultravox

Native audio-understanding model (Whisper encoder → projector → frozen LLM). Eliminates STT step. **Output is text only** — still needs TTS.

---

### TEN Framework — ⭐ 10.4k
**GitHub:** https://github.com/TEN-framework/ten-framework

Extension-based architecture. Own VAD model (TEN-VAD). Sub-500ms target. Supports C/C++/Go/Python/JS/TS.

---

### Sesame CSM — ⭐ 14.6k
**GitHub:** https://github.com/SesameAILabs/csm

1B-param speech generation model. Not full-duplex — one-way generation focused on natural conversational prosody.

---

### Microsoft VibeVoice — ⭐ 36.1k
**GitHub:** https://github.com/microsoft/VibeVoice

Component models (TTS 1.5B, ASR 7B, Realtime 0.5B). ~300ms first-audio latency for realtime variant. 50+ languages for ASR.

---

## Comparison: vMira vs Industry

| Feature | vMira (current) | OpenAI Realtime | Claude | Pipecat | LiveKit | Moshi |
|---------|----------------|----------------|--------|---------|---------|-------|
| **Architecture** | Browser STT→LLM→TTS | Native audio model | STT→LLM→TTS | STT→LLM→TTS + S2S | STT→LLM→TTS + S2S | Native S2S full-duplex |
| **Latency** | ~2-4s | ~800ms-1.7s | ~1-3s | 500-800ms | ~1.3s | **160-200ms** |
| **VAD** | Amplitude threshold | Server/Semantic VAD | None (manual) | Silero + Smart Turn AI | Silero + Semantic model | Inherent |
| **Interruption** | Amplitude threshold | Native, configurable | None | Playback-synced | **Adaptive (AI model)** | Inherent |
| **Echo cancellation** | Browser AEC + cooldown | Browser AEC (WebRTC) | N/A | WebRTC + Krisp/Koala | AEC warmup + Krisp | Web UI AEC |
| **Turn detection quality** | Basic (noise-prone) | Good (semantic option) | Manual | **Excellent (Smart Turn)** | **Excellent (semantic)** | Perfect (full-duplex) |
| **Cost/minute** | ~$0.002 (ElevenLabs) | ~$0.30 | ~$0.01-0.05 | Depends on providers | Depends on providers | Free (self-hosted) |
| **Browser support** | Yes (native) | Yes (WebRTC) | No API | Via WebRTC transport | Via WebRTC SDK | WebSocket client |

---

## Key Gaps in vMira

### 1. Turn Detection (HIGHEST IMPACT)
vMira uses a simple amplitude threshold + timer. This is the root cause of messages getting cut off and echo problems. Industry solutions use:
- **Silero VAD** (voice activity detection, not just amplitude) — distinguishes speech from noise
- **Semantic turn models** — AI determines if user finished their thought
- **Adaptive interruption** — distinguishes "uh-huh" from actual barge-in

### 2. Server-Side VAD
vMira does all voice detection client-side (browser AudioContext). Better approach: stream audio to a server-side VAD (Silero is <1ms per 30ms chunk) that's more reliable than browser amplitude detection.

### 3. Echo Cancellation
Browser AEC is unreliable across devices. Pipecat/LiveKit integrate Krisp or similar models for robust echo suppression. vMira's 600ms cooldown is a workaround, not a solution.

### 4. Streaming TTS Overlap
vMira waits for a full sentence before sending to TTS. Better: stream partial text to TTS as tokens arrive (Pipecat/LiveKit do this), reducing perceived latency.

### 5. No Full-Duplex
vMira is strictly half-duplex (listen OR speak). Full-duplex (Moshi) or overlapping awareness (OpenAI Realtime) enables more natural conversation.

---

## Recommended Improvements (Priority Order)

### P0 — Use Silero VAD instead of amplitude threshold
Replace the raw `analyser.getByteFrequencyData` amplitude check with Silero VAD (available as ONNX, runs in browser via onnxruntime-web in ~1ms). This alone fixes most false triggers and echo issues.

### P1 — Stream TTS as tokens arrive
Instead of waiting for clause boundaries, start TTS as soon as the first ~50 characters arrive. ElevenLabs supports input streaming via WebSocket — send tokens as they come, audio starts almost immediately.

### P2 — Evaluate Pipecat or LiveKit for server-side voice pipeline
Moving VAD + audio routing to the server (via WebRTC) gives access to Krisp echo cancellation, semantic turn detection, and adaptive interruption — all impossible in the browser alone.

### P3 — Consider OpenAI Realtime for premium tier
At ~$0.30/min it's expensive for all users, but could be a premium "HD Voice" feature. Native audio understanding, semantic VAD, and sub-1s latency are compelling.

### P4 — Watch Moshi for future self-hosted option
At 160ms latency with full-duplex, Moshi is the ultimate goal. Currently limited by the 7B model's language capabilities, but multilingual support is coming.

---

## Sources

### OpenAI
- [Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [Realtime WebRTC](https://platform.openai.com/docs/guides/realtime-webrtc)
- [Realtime VAD](https://platform.openai.com/docs/guides/realtime-vad)
- [Realtime Costs](https://developers.openai.com/api/docs/guides/realtime-costs)
- [Introducing gpt-realtime (GA)](https://openai.com/index/introducing-gpt-realtime/)
- [Latency Measurement](https://webrtchacks.com/measuring-the-response-latency-of-openais-webrtc-based-real-time-api/)
- [openai/openai-realtime-agents](https://github.com/openai/openai-realtime-agents)
- [openai/openai-realtime-console](https://github.com/openai/openai-realtime-console)

### Open Source
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 11k stars, BSD-2
- [Pipecat Smart Turn](https://github.com/pipecat-ai/smart-turn)
- [LiveKit Agents](https://github.com/livekit/agents) — 9.9k stars, Apache-2
- [LiveKit Adaptive Interruption](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/)
- [Moshi](https://github.com/kyutai-labs/moshi) — 10k stars, Apache-2
- [Ultravox](https://github.com/fixie-ai/ultravox) — 4.4k stars, MIT
- [TEN Framework](https://github.com/TEN-framework/ten-framework) — 10.4k stars, Apache-2
- [Sesame CSM](https://github.com/SesameAILabs/csm) — 14.6k stars, Apache-2
- [Microsoft VibeVoice](https://github.com/microsoft/VibeVoice) — 36.1k stars, MIT
- [HF Speech-to-Speech](https://github.com/huggingface/speech-to-speech) — 4.6k stars, Apache-2
- [Vocode](https://github.com/vocodedev/vocode-core) — 3.7k stars, MIT (stagnant)
- [Modal: 1s Latency with Pipecat](https://modal.com/blog/low-latency-voice-bot)
- [Daily: Benchmarking STT](https://www.daily.co/blog/benchmarking-stt-for-voice-agents/)
