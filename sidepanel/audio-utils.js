/**
 * Audio Processing Utilities for PCM/Float Conversion
 */

export function floatTo16BitPCM(floatArray) {
    const buffer = new ArrayBuffer(floatArray.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < floatArray.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, floatArray[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Uint8Array(buffer);
}

export function pcm16ToFloat(uint8Array) {
    const int16Array = new Int16Array(uint8Array.buffer);
    const floatArray = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
        floatArray[i] = int16Array[i] / 0x8000;
    }
    return floatArray;
}

export function base64Encode(uint8Array) {
    let binary = '';
    uint8Array.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
}

export function base64Decode(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
