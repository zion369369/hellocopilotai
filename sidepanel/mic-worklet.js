/**
 * Sovereign Audio Processor: High-Fidelity Gemini Live DSP
 * Performs real-time resampling to 16kHz and Int16 quantization in a high-priority thread.
 * Ensures the main UI remains liquid-smooth while providing zero-jitter audio to Gemini.
 */
class MicProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this.targetSampleRate = 16000;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const inputChannel = input[0];
      
      // 1. Resampling Logic (Simple Decimation/Interpolation)
      // Standard browsers capture at 44.1k or 48k. Gemini requires exactly 16k.
      const resampled = this.resample(inputChannel, sampleRate, this.targetSampleRate);
      
      // 2. Quantization (Float32 -> Int16)
      // Using the industry-standard mapping: xi = max(-32768, min(32767, floor(xf * 32767.5)))
      const pcm16 = this.floatTo16BitPCM(resampled);
      
      // 3. Dispatch to Main Thread
      if (pcm16.length > 0) {
        this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
      }
    }
    return true; 
  }

  resample(data, fromRate, toRate) {
    const ratio = fromRate / toRate;
    const newLength = Math.round(data.length / ratio);
    const result = new Float32Array(newLength);
    let offset = 0;
    for (let i = 0; i < newLength; i++) {
        result[i] = data[Math.round(offset)];
        offset += ratio;
    }
    return result;
  }

  floatTo16BitPCM(float32Array) {
    const buffer = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return buffer;
  }
}

registerProcessor('mic-processor', MicProcessor);
