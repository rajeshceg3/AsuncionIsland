// Generic browser glue for world soundscapes. All synthesis lives in
// soundscape-dsp.js; this wires rendered buffers into WebAudio.
// Sound is opt-in: nothing is created until Sound on is pressed; Sound off
// closes the AudioContext entirely.
//
// A place definition: {
//   id,
//   beds: [{ type: 'surf' | 'wind', params: {...}, gain: 0..1 }],   // looped beds, crossfade on place change
//   voices: [{ kind: 'koel'|'gull'|'putter'|'bell'|'camelBells'|'rickshawBell'|'dove'|'kite'|'nightjar', weight, gain }],
//   voiceGap: [minSeconds, maxSeconds]                               // sparse one-shot scheduling
// }

import * as DSP from './soundscape-dsp.js';

const BEDS = { surf: DSP.renderSurfLoop, wind: DSP.renderWindLoop, stream:DSP.renderStreamLoop, insects:DSP.renderInsectsLoop, rustle:DSP.renderRustleLoop };
const VOICES = {
  koel: DSP.renderKoel, gull: DSP.renderGull, putter: DSP.renderPutter,
  bell: DSP.renderBell, camelBells: DSP.renderCamelBells, rickshawBell: DSP.renderRickshawBell,
  dove: DSP.renderDove, kite: DSP.renderKite, nightjar: DSP.renderNightjar,
  cuckoo: DSP.renderCuckoo,
  coppersmith: DSP.renderCoppersmith,
};

export function createSoundscape(SOUND_PLACES) {
  const state = { ctx: null, on: false, audio: null, gain: null, source: null };
  const rng = DSP.makeRng((Date.now() % 100000) + 1);
  const buffers = {};
  let master = null, place = 0, voiceTimer = 0;
  let liveBeds = []; // [{src, gain, key}]

  function bedBuffer(key, type, params) {
    if (buffers[key]) return buffers[key];
    const sr = state.ctx.sampleRate;
    const d = BEDS[type](sr, params, rng);
    const b = state.ctx.createBuffer(2, d.left.length, sr);
    b.getChannelData(0).set(d.left);
    b.getChannelData(1).set(d.right);
    buffers[key] = b;
    return b;
  }

  function startBeds(p) {
    const t = state.ctx.currentTime;
    for (const old of liveBeds) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + 2);
      setTimeout(() => { try { old.src.stop(); } catch { } }, 2600);
    }
    liveBeds = SOUND_PLACES[p].beds.map((bed, i) => {
      const src = state.ctx.createBufferSource();
      src.buffer = bedBuffer(place + ':' + i, bed.type, bed.params);
      src.loop = true;
      const g = state.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(bed.gain, t + 2);
      src.connect(g).connect(master);
      src.start();
      return { src, gain: g };
    });
    state.source = liveBeds[0]?.src || null;
  }

  function pickVoice(p) {
    const vs = SOUND_PLACES[p].voices;
    let total = 0;
    for (const v of vs) total += v.weight;
    let r = rng() * total;
    for (const v of vs) { r -= v.weight; if (r <= 0) return v; }
    return vs[vs.length - 1];
  }

  function playVoice() {
    const v = pickVoice(place);
    const data = VOICES[v.kind](state.ctx.sampleRate, rng, v.params || {});
    const b = state.ctx.createBuffer(1, data.length, state.ctx.sampleRate);
    b.getChannelData(0).set(data);
    const src = state.ctx.createBufferSource();
    src.buffer = b;
    const g = state.ctx.createGain();
    g.gain.value = v.gain * (0.7 + rng() * 0.6);
    if (state.ctx.createStereoPanner) {
      const pan = state.ctx.createStereoPanner();
      pan.pan.value = rng() * 1.4 - 0.7;
      src.connect(g).connect(pan).connect(master);
    } else src.connect(g).connect(master);
    src.start();
  }

  function scheduleVoice() {
    if (!state.on || !SOUND_PLACES[place].voices.length) return;
    const [lo, hi] = SOUND_PLACES[place].voiceGap || [20, 45];
    voiceTimer = setTimeout(() => { playVoice(); scheduleVoice(); }, (lo + rng() * (hi - lo)) * 1000);
  }

  function on(p) {
    place = p; state.place=p;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    state.ctx = ctx;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    state.gain = master;
    startBeds(place);
    ctx.resume();
    state.on = true;
    scheduleVoice();
  }

  function off() {
    clearTimeout(voiceTimer);
    for (const b of liveBeds) { try { b.src.stop(); } catch { } }
    liveBeds = [];
    state.ctx?.close();
    state.ctx = null; state.source = null; state.gain = null; master = null;
    for (const k in buffers) delete buffers[k];
    state.on = false;
  }

  function setPlace(p) {
    place = p; state.place=p;
    if (!state.on) return;
    startBeds(p);
    clearTimeout(voiceTimer);
    scheduleVoice();
  }

  return { state, toggle: p => { state.on ? off() : on(p); return state.on; }, setPlace };
}
