/* Original ambient sound for the shore, synthesised live with Web Audio: no samples, no licensed sources.
   Surf = looped pink-ish noise, low-passed, swelling on a slow wave cycle; a thin high hiss rides the crest;
   wind = band-passed noise drifting in pitch and level. Silent until the visitor turns it on. */
export function createShoreAudio() {
  let ctx = null, master = null, on = false, active = false, graph = null;
  const level = 0.5;

  function noiseBuffer(c) {
    const len = c.sampleRate * 6, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {            // Paul Kellet pink-noise filter
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    // crossfade the loop seam so it never clicks
    const f = Math.floor(c.sampleRate * 0.25);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[len - f + i] * (1 - k); }
    return buf;
  }

  function build(c, dest) {
    const buf = noiseBuffer(c);
    const src = (off) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0.25; s.start(0, off); return s; };
    const lfo = (hz, depth, target, phase = 0) => {
      const o = c.createOscillator(); o.frequency.value = hz; const g = c.createGain(); g.gain.value = depth;
      o.connect(g); g.connect(target); o.start(c.currentTime + phase); return o;
    };
    // surf body
    const s1 = src(0), lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 850; lp.Q.value = 0.4;
    const swell = c.createGain(); swell.gain.value = 0.42;
    s1.connect(lp); lp.connect(swell); swell.connect(dest);
    lfo(0.11, 0.34, swell.gain);                 // about a nine second wave cycle
    lfo(0.047, 0.08, swell.gain, 1.3);           // slower set of larger waves
    // crest hiss
    const s2 = src(2.1), hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2600;
    const hiss = c.createGain(); hiss.gain.value = 0.05;
    s2.connect(hp); hp.connect(hiss); hiss.connect(dest);
    lfo(0.11, 0.045, hiss.gain, 0.9);            // peaks just after the body swell
    // wind
    const s3 = src(3.7), bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 420; bp.Q.value = 0.8;
    const wind = c.createGain(); wind.gain.value = 0.2;
    s3.connect(bp); bp.connect(wind); wind.connect(dest);
    lfo(0.07, 140, bp.frequency, 0.4); lfo(0.05, 0.1, wind.gain, 2);
    return { stop() { try { [s1, s2, s3].forEach((s) => s.stop()); } catch (_) {} } };
  }

  function apply() {
    if (!ctx || !master) return;
    const t = ctx.currentTime, target = on && active ? level : 0;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(target, t + (target ? 2.5 : 1.2));
    if (target) ctx.resume(); else setTimeout(() => { if (!(on && active) && ctx && ctx.state === "running") ctx.suspend(); }, 1400);
  }

  return {
    /* must be called from a user gesture the first time */
    async setEnabled(v) {
      on = v;
      if (on && !ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { on = false; return false; }
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
        graph = build(ctx, master);
      }
      apply();
      return on;
    },
    setActive(v) { active = v; apply(); },
    isOn: () => on,
    /* test hook: render the same graph offline and return level statistics, no speakers needed */
    async measure(seconds = 24) {
      const c = new OfflineAudioContext(1, 22050 * seconds, 22050);
      build(c, c.destination);
      const out = (await c.startRendering()).getChannelData(0);
      const win = 22050, rms = [];
      for (let i = 0; i + win <= out.length; i += win) { let s = 0; for (let j = 0; j < win; j++) s += out[i + j] ** 2; rms.push(Math.sqrt(s / win)); }
      let peak = 0, nan = 0; for (const v of out) { if (!Number.isFinite(v)) nan++; peak = Math.max(peak, Math.abs(v)); }
      return { peak, nan, rmsMin: Math.min(...rms), rmsMax: Math.max(...rms), rms };
    },
    get state() { return ctx ? ctx.state : "none"; },
    get gain() { return master ? master.gain.value : 0; },
  };
}
