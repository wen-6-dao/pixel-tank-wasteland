/**
 * 背景音乐系统（与音效完全独立）：
 * - 优先加载 assets/music.ogg（或构建时内联的 data: URL）；缺失/离线时回退到
 *   Web Audio 程序化 8-bit 循环，保证任何时候都有 BGM。
 * - M 只控制音效（sfx）；B / 界面 ♪ 按钮只控制音乐，互不影响。
 * - 音量可自由调节（0~1），开关与音量都由外部持久化（save）。
 * - 首次用户手势立即出声；后续每次手势都会自动修复“卡住”的播放状态。
 */

// 离线构建脚本会把这个占位符替换成 data:audio/ogg;base64,...；开发模式保持占位。
const MUSIC_SRC = '__MUSIC_DATA_URL__';

const DEFAULT_VOLUME = 0.55;

// 96 BPM、16 个八分音符的极简 8-bit 循环（低音量，不干扰音效）
const PATTERN = {
  bpm: 96,
  bass: [45, 45, 48, 45, 50, 50, 53, 50, 43, 43, 47, 43, 41, 41, 45, 41],
  lead: [null, 69, null, 72, null, 74, null, 72, null, 69, null, 65, null, 62, null, 57],
};

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function createNoiseBuffer(ctx) {
  const len = Math.floor(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(ctx, dest, { freq, t, dur, type = 'triangle', vol = 0.2 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function hat(ctx, dest, noiseBuf, t) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.055, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t);
  src.stop(t + 0.08);
}

export function createMusic() {
  let ctx = null;
  let master = null;
  let audio = null;
  let procedural = null;
  let enabled = true;
  let volume = DEFAULT_VOLUME;
  let started = false;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? volume : 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function applyVolume() {
    if (audio) audio.volume = enabled ? volume : 0;
    if (ctx && master) master.gain.value = enabled ? volume : 0;
  }

  function stopProcedural() {
    if (!procedural) return;
    procedural.stop();
    procedural = null;
  }

  function startProcedural() {
    const c = ensureCtx();
    if (!c || procedural) return;
    const noiseBuf = createNoiseBuffer(c);
    let step = 0;
    let next = c.currentTime + 0.08;
    let timer = null;

    function playStep(t) {
      const idx = step % PATTERN.bass.length;
      tone(c, master, {
        freq: midiToFreq(PATTERN.bass[idx]),
        t,
        dur: 0.24,
        type: 'triangle',
        vol: 0.6,
      });
      const lead = PATTERN.lead[idx];
      if (lead != null && step % 4 === 0) {
        tone(c, master, { freq: midiToFreq(lead), t, dur: 0.14, type: 'square', vol: 0.16 });
      }
      if (step % 2 === 0) hat(c, master, noiseBuf, t);
      step = (step + 1) % PATTERN.bass.length;
    }

    function schedule() {
      const stepDur = 60 / PATTERN.bpm / 2;
      while (next < c.currentTime + 0.3) {
        playStep(next);
        next += stepDur;
      }
      timer = setTimeout(schedule, 90);
    }

    schedule();
    procedural = {
      stop() {
        clearTimeout(timer);
      },
    };
  }

  function applyEnabled() {
    if (audio) {
      audio.volume = enabled ? volume : 0;
      if (enabled) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }
    if (ctx && master) master.gain.value = enabled ? volume : 0;
  }

  /** 探测音频资源是否存在；带超时，避免网络慢时卡住 */
  function probeMusic() {
    return new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      }, 1200);
      const finish = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      };
      fetch('music-probe.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => {
          if (p?.music) finish(true);
          else if (p) finish(false);
          else {
            // 静态托管无探测文件：直接 HEAD 音频资源
            fetch('assets/music.ogg', { method: 'HEAD' })
              .then((r2) => finish(r2.ok))
              .catch(() => finish(false));
          }
        })
        .catch(() => finish(false));
    });
  }

  function bootstrap() {
    const inlined = typeof MUSIC_SRC === 'string' && MUSIC_SRC.startsWith('data:');
    if (inlined) {
      startFileAudio(MUSIC_SRC);
      return;
    }
    // 先立即启动程序化 BGM（保证首次手势就有声音），探测到文件后再无缝切换
    startProcedural();
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      probeMusic().then((hasMusic) => {
        if (hasMusic) startFileAudio('assets/music.ogg');
      });
    }
  }

  function startFileAudio(src) {
    const a = new Audio();
    a.loop = true;
    a.preload = 'auto';
    a.volume = enabled ? volume : 0;

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        startProcedural();
      }
    }, 3000);
    const done = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ok) {
        audio = a;
        if (enabled) {
          // 播放成功后再停掉程序化 BGM；iOS 等环境可能拒绝异步 play()，
          // 此时保留程序化 BGM 避免静音
          audio
            .play()
            .then(() => stopProcedural())
            .catch(() => {});
        } else {
          stopProcedural();
        }
      } else {
        startProcedural();
      }
    };
    a.addEventListener('canplaythrough', () => done(true), { once: true });
    a.addEventListener('error', () => done(false), { once: true });
    try {
      a.src = src;
      a.load();
    } catch {
      done(false);
    }
  }

  return {
    get enabled() {
      return enabled;
    },
    get volume() {
      return volume;
    },
    setEnabled(on) {
      enabled = !!on;
      applyEnabled();
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0));
      applyVolume();
    },
    /**
     * 用户手势后调用：解锁 AudioContext、确保 BGM 已启动。
     * 可多次调用——每次手势都会尝试修复“卡住”的播放状态。
     */
    unlock() {
      const c = ensureCtx();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
      if (!started) {
        started = true;
        bootstrap();
      } else if (enabled) {
        if (audio && audio.paused) audio.play().catch(() => {});
        if (!procedural && !audio) startProcedural();
      }
    },
  };
}
