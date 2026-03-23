FROM python:3.11-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir faster-whisper flask gunicorn

# Pre-download model at build time (cached in image)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

COPY server.py /app/server.py
WORKDIR /app

EXPOSE 8787

# Single worker — transcription is CPU-bound, more workers won't help on 2 vCPU
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8787", "--timeout", "120", "server:app"]
