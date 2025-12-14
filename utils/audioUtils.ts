import { Blob } from '@google/genai';

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts Float32 audio data to Int16 PCM and downsamples to 16000Hz.
 * This conversion is critical for the Gemini Live API to function correctly
 * without tokenizer errors.
 */
export function createPcmBlob(data: Float32Array, inputSampleRate: number): Blob {
  const targetSampleRate = 16000;
  let int16Data: Int16Array;

  if (inputSampleRate === targetSampleRate) {
    // Direct conversion if already 16kHz
    int16Data = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  } else {
    // Downsample to 16kHz
    const ratio = inputSampleRate / targetSampleRate;
    const newLength = Math.ceil(data.length / ratio);
    int16Data = new Int16Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
      const index = i * ratio;
      // Use nearest neighbor for simplicity and speed on the main thread
      const val = data[Math.floor(index)] || 0;
      const s = Math.max(-1, Math.min(1, val));
      int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }

  return {
    data: arrayBufferToBase64(int16Data.buffer),
    mimeType: 'audio/pcm;rate=16000',
  };
}