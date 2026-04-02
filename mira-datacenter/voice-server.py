#!/usr/bin/env python3
"""
Mira Voice Server — GPU-accelerated STT + TTS
Runs on the GPU instance alongside llama-server.

STT: faster-whisper (CTranslate2, CUDA) — ~200ms for short audio
TTS: Silero TTS (PyTorch, CUDA) — ~100ms per sentence, natural Russian voice

Endpoints:
  POST /transcribe   multipart: audio file → { text, language }
  POST /synthesize    json: { text, language } → audio/wav bytes
  GET  /health        → { status: "ok" }
"""

import io
import os
import time
import torch
import numpy as np
from flask import Flask, request, jsonify, Response

app = Flask(__name__)

# ── STT: faster-whisper ──────────────────────────────────────────────────────

stt_model = None

def get_stt():
    global stt_model
    if stt_model is None:
        from faster_whisper import WhisperModel
        # Use "base" for speed/quality balance — ~200ms on GPU for short audio
        # "tiny" is fastest (~100ms) but lower quality for Russian
        stt_model = WhisperModel("base", device="cuda", compute_type="float16")
        print("[STT] faster-whisper base loaded on CUDA")
    return stt_model

# ── TTS: Silero ──────────────────────────────────────────────────────────────

tts_model = None
tts_sample_rate = 48000

LANG_SPEAKERS = {
    "ru": ("ru_v3", "baya"),        # Natural Russian female voice
    "en": ("en_v3", "en_21"),       # Natural English female voice
    "de": ("de_v3", "bernd_ungeduldig"),
    "es": ("es_v3", "es_0"),
    "fr": ("fr_v3", "fr_0"),
}

def get_tts(lang="ru"):
    global tts_model, tts_sample_rate
    lang_key = lang[:2] if lang else "ru"
    model_id, speaker = LANG_SPEAKERS.get(lang_key, ("ru_v3", "baya"))

    # Silero models are language-specific, cache the current one
    if tts_model is None or getattr(tts_model, '_lang_id', None) != model_id:
        tts_model = torch.hub.load(
            repo_or_dir='snakers4/silero-models',
            model='silero_tts',
            language=lang_key,
            speaker=model_id,
        )
        tts_model._lang_id = model_id
        if torch.cuda.is_available():
            tts_model = tts_model.to(torch.device('cuda'))
        tts_sample_rate = 48000
        print(f"[TTS] Silero {model_id} loaded, speaker={speaker}")

    return tts_model, speaker

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    t0 = time.time()

    if "audio" not in request.files:
        return jsonify({"error": "No audio file"}), 400

    audio_file = request.files["audio"]
    language_hint = request.form.get("language", None)

    # Save to temp file (faster-whisper needs a file path or numpy array)
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        audio_file.save(f)
        tmp_path = f.name

    try:
        model = get_stt()
        segments, info = model.transcribe(
            tmp_path,
            language=language_hint,
            beam_size=1,           # Fastest: greedy decoding
            best_of=1,
            vad_filter=True,       # Skip silence
            vad_parameters=dict(min_silence_duration_ms=300),
        )

        text = " ".join(seg.text.strip() for seg in segments)
        elapsed = time.time() - t0
        print(f"[STT] {elapsed:.3f}s — '{text[:80]}'")

        return jsonify({
            "text": text,
            "language": info.language,
            "duration": info.duration,
            "processing_time": elapsed,
        })
    finally:
        os.unlink(tmp_path)


@app.route("/synthesize", methods=["POST"])
def synthesize():
    t0 = time.time()

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    language = data.get("language", "ru")

    if not text:
        return jsonify({"error": "No text"}), 400
    if len(text) > 2000:
        return jsonify({"error": "Text too long"}), 400

    try:
        model, speaker = get_tts(language)
        audio = model.apply_tts(
            text=text,
            speaker=speaker,
            sample_rate=tts_sample_rate,
        )

        # Convert to WAV bytes
        if isinstance(audio, torch.Tensor):
            audio = audio.cpu().numpy()

        buf = io.BytesIO()
        import wave
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(tts_sample_rate)
            # Normalize and convert to int16
            audio_np = np.clip(audio, -1.0, 1.0)
            wf.writeframes((audio_np * 32767).astype(np.int16).tobytes())

        elapsed = time.time() - t0
        print(f"[TTS] {elapsed:.3f}s — {len(text)} chars")

        buf.seek(0)
        return Response(buf.read(), mimetype="audio/wav")

    except Exception as e:
        print(f"[TTS] Error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Preload models on startup
    print("[Voice Server] Starting — preloading models...")
    get_stt()
    get_tts("ru")
    print("[Voice Server] Ready on port 8090")
    app.run(host="0.0.0.0", port=8090, threaded=True)
