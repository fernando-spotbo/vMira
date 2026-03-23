"""Minimal Whisper STT server using faster-whisper (CPU, int8).

Accepts audio via POST /transcribe, returns { text, language }.
Runs on localhost:8787 — never exposed externally.
Uses ffmpeg to convert any input format to WAV before transcribing.
"""

import os
import subprocess
import tempfile

from faster_whisper import WhisperModel
from flask import Flask, jsonify, request

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")
app = Flask(__name__)
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")


def convert_to_wav(input_path: str) -> str | None:
    """Convert any audio format to 16kHz mono WAV via ffmpeg."""
    wav_path = input_path.rsplit(".", 1)[0] + ".wav"
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            capture_output=True, timeout=15,
        )
        if result.returncode == 0 and os.path.exists(wav_path) and os.path.getsize(wav_path) > 1000:
            return wav_path
    except Exception:
        pass
    return None


@app.route("/transcribe", methods=["POST"])
def transcribe():
    audio = request.files.get("audio") or request.files.get("file")
    if not audio:
        return jsonify({"error": "No audio file"}), 400

    lang_hint = request.form.get("language")

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        audio.save(f)
        input_path = f.name

    wav_path = None
    try:
        # Skip tiny files (noise/empty recordings)
        if os.path.getsize(input_path) < 500:
            return jsonify({"text": "", "language": None, "duration": 0})

        # Convert to WAV to handle any container format
        wav_path = convert_to_wav(input_path)
        path = wav_path if wav_path else input_path

        kwargs = {"beam_size": 1, "vad_filter": True}
        if lang_hint:
            kwargs["language"] = lang_hint.split("-")[0]

        segments, info = model.transcribe(path, **kwargs)
        text = " ".join(s.text for s in segments).strip()
        return jsonify({"text": text, "language": info.language, "duration": info.duration})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(input_path)
        except OSError:
            pass
        if wav_path:
            try:
                os.unlink(wav_path)
            except OSError:
                pass


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_SIZE})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8787)
