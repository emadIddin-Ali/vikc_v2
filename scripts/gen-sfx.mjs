/**
 * Generates LEVLA's sound effects into assets/sfx/ as 16-bit mono WAVs.
 *
 * The sounds are synthesised rather than sourced, so they're licence-free and
 * tweakable: change a note list below and re-run `node scripts/gen-sfx.mjs`.
 * Bell-ish tones (a fundamental plus a couple of quiet harmonics, fast attack,
 * exponential decay) sit well under Fredoka's friendly look.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');

// Equal-tempered pitches we use, in Hz.
const N = {
  C6: 1046.5, E6: 1318.51, G6: 1567.98, B6: 1975.53,
  C7: 2093.0, E7: 2637.02, G7: 3135.96,
};

/**
 * @param {number} durSec total length
 * @param {{at:number,f:number,dur:number,decay:number,amp?:number,harm?:number[],vib?:boolean}[]} notes
 */
function mix(durSec, notes) {
  const n = Math.ceil(SR * durSec);
  const out = new Float32Array(n);

  for (const nt of notes) {
    const start = Math.floor(nt.at * SR);
    const len = Math.floor(nt.dur * SR);
    const harm = nt.harm ?? [1, 0.3, 0.1];
    const amp = nt.amp ?? 1;

    for (let i = 0; i < len && start + i < n; i++) {
      const t = i / SR;
      // 2.5 ms attack so nothing clicks, then exponential decay.
      const env = Math.exp(-t * nt.decay) * (1 - Math.exp(-t * 400));
      const vib = nt.vib ? 1 + 0.006 * Math.sin(2 * Math.PI * 6 * t) : 1;
      let s = 0;
      for (let h = 0; h < harm.length; h++) {
        s += harm[h] * Math.sin(2 * Math.PI * nt.f * (h + 1) * vib * t);
      }
      out[start + i] += s * env * amp;
    }
  }

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak > 0 ? 0.89 / peak : 1;
  const fade = Math.floor(SR * 0.02);
  for (let i = 0; i < n; i++) {
    let v = out[i] * gain;
    if (i > n - fade) v *= (n - i) / fade; // avoid a tail click
    out[i] = v;
  }
  return out;
}

function wav(samples) {
  const dataLen = samples.length * 2;
  const b = Buffer.alloc(44 + dataLen);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + dataLen, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(1, 22); // mono
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}

const SOUNDS = {
  // Soft UI blip. Deliberately dull and short so it never nags.
  tap: mix(0.07, [{ at: 0, f: 1200, dur: 0.07, decay: 55, harm: [1, 0.12], amp: 0.5 }]),

  // Checked in: a bright rising two-note chime.
  checkin: mix(0.6, [
    { at: 0, f: N.E6, dur: 0.55, decay: 9, harm: [1, 0.35, 0.12] },
    { at: 0.09, f: N.B6, dur: 0.5, decay: 8, harm: [1, 0.3, 0.1] },
  ]),

  // Level up: a four-note ascending fanfare.
  levelup: mix(1.0, [
    { at: 0, f: N.C6, dur: 0.7, decay: 6.5 },
    { at: 0.08, f: N.E6, dur: 0.7, decay: 6.5 },
    { at: 0.16, f: N.G6, dur: 0.75, decay: 6 },
    { at: 0.24, f: N.C7, dur: 0.75, decay: 5.5, harm: [1, 0.25, 0.08] },
  ]),

  // New badge: a quick sparkle that settles into a shimmering chord.
  badge: mix(0.85, [
    { at: 0, f: N.G6, dur: 0.2, decay: 16, amp: 0.7 },
    { at: 0.06, f: N.C7, dur: 0.2, decay: 16, amp: 0.7 },
    { at: 0.12, f: N.E7, dur: 0.2, decay: 16, amp: 0.7 },
    { at: 0.18, f: N.G7, dur: 0.22, decay: 14, amp: 0.6 },
    { at: 0.24, f: N.C7, dur: 0.6, decay: 5, vib: true },
    { at: 0.24, f: N.E7, dur: 0.6, decay: 5.5, amp: 0.7, vib: true },
  ]),

  // Points spent/earned in the shop.
  coin: mix(0.4, [
    { at: 0, f: N.B6, dur: 0.16, decay: 18, harm: [1, 0.2] },
    { at: 0.05, f: N.E7, dur: 0.34, decay: 11, harm: [1, 0.2] },
  ]),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = join(OUT, `${name}.wav`);
  const buf = wav(samples);
  writeFileSync(file, buf);
  console.log(`${name}.wav  ${(buf.length / 1024).toFixed(1)} kB  ${(samples.length / SR).toFixed(2)}s`);
}
