/**
 * AudioWorklet processor — captures mic audio at the browser's native sample rate
 * (44.1 kHz or 48 kHz) and resamples to 16 kHz PCM16 for sending over WebSocket.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    const ratio = sampleRate / 16000; // sampleRate is a global in AudioWorklet scope

    // Accumulate incoming samples
    const newBuf = new Float32Array(this._buffer.length + input.length);
    newBuf.set(this._buffer);
    newBuf.set(input, this._buffer.length);
    this._buffer = newBuf;

    // Downsample: pick every Nth sample (linear nearest-neighbor)
    const outLen = Math.floor(this._buffer.length / ratio);
    if (outLen < 160) return true; // wait for at least 10ms of 16 kHz data

    const pcm16 = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = Math.min(Math.floor(i * ratio), this._buffer.length - 1);
      pcm16[i] = Math.max(-32768, Math.min(32767, this._buffer[srcIdx] * 32768));
    }

    // Keep remainder samples for next call
    const consumed = Math.floor(outLen * ratio);
    this._buffer = this._buffer.slice(consumed);

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
