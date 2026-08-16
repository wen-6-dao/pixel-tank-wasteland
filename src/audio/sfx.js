/**
 * Web Audio 8-bit 音效：用方波/三角波/锯齿波 + 噪声合成，
 * 低音量、快速衰减包络，避免刺耳；带并发音色上限与静音开关。
 */
export function createSfx() {
  const MAX_VOICES = 12;
  const MASTER_GAIN = 0.45;
  let ctx = null;
  let master = null;
  let muted = false;
  const voices = new Set();
  const stats = { plays: 0, drops: 0 };

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
  }

  function track(node) {
    voices.add(node);
    node.onended = () => voices.delete(node);
  }

  function tone({ freq, end = null, dur, type = 'square', vol = 0.12, delay = 0 }) {
    stats.plays += 1;
    if (!ctx || muted || voices.size >= MAX_VOICES) {
      if (voices.size >= MAX_VOICES) stats.drops += 1;
      return;
    }
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (end) osc.frequency.exponentialRampToValueAtTime(Math.max(1, end), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    track(osc);
  }

  function noiseBurst({ dur = 0.2, vol = 0.15, freq = 1200, delay = 0 }) {
    stats.plays += 1;
    if (!ctx || muted || voices.size >= MAX_VOICES) {
      if (voices.size >= MAX_VOICES) stats.drops += 1;
      return;
    }
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
    track(src);
  }

  return {
    MAX_VOICES,
    stats,
    get muted() {
      return muted;
    },
    get masterGain() {
      return master ? master.gain.value : MASTER_GAIN;
    },
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggleMuted() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
      return muted;
    },
    // —— 8-bit 音效 ——
    shoot() {
      tone({ freq: 950, end: 480, dur: 0.07, type: 'square', vol: 0.1 });
    },
    explosion(big = false) {
      noiseBurst({ dur: big ? 0.5 : 0.28, vol: big ? 0.24 : 0.16, freq: big ? 900 : 1400 });
      tone({ freq: big ? 140 : 180, end: 40, dur: big ? 0.45 : 0.28, type: 'triangle', vol: big ? 0.26 : 0.18 });
    },
    brick() {
      noiseBurst({ dur: 0.07, vol: 0.07, freq: 2600 });
    },
    enemyDie() {
      tone({ freq: 420, end: 150, dur: 0.16, type: 'square', vol: 0.09 });
      noiseBurst({ dur: 0.1, vol: 0.06, freq: 1800 });
    },
    upgrade() {
      [523, 659, 784, 1047].forEach((f, i) => {
        tone({ freq: f, dur: 0.12, type: 'square', vol: 0.09, delay: i * 0.08 });
      });
    },
    hurt() {
      tone({ freq: 240, end: 90, dur: 0.22, type: 'sawtooth', vol: 0.12 });
      noiseBurst({ dur: 0.12, vol: 0.09, freq: 800 });
    },
    boss() {
      tone({ freq: 80, end: 170, dur: 0.8, type: 'sawtooth', vol: 0.14 });
      tone({ freq: 55, end: 115, dur: 0.8, type: 'triangle', vol: 0.18 });
      noiseBurst({ dur: 0.6, vol: 0.1, freq: 400 });
    },
    pickup() {
      tone({ freq: 700, end: 1150, dur: 0.08, type: 'square', vol: 0.06 });
    },
  };
}
