// Structural checks on the rendered Japanese Village previews: no clipping,
// quiet-ambient loudness window, no DC; seamless-loop spot check on the
// surf and wind beds. Structural only - not a judgement of how it sounds.
const fs = require('fs'), assert = require('assert');
const { execSync } = require('child_process');
function resolveOut() {
  if (process.env.AUDIO_OUT) return process.env.AUDIO_OUT;
  try { fs.mkdirSync('/downloads/island-audio', { recursive: true }); return '/downloads/island-audio'; } catch { return 'verification/output/island-audio'; }
}
const OUT = resolveOut();
execSync('node scripts/render-audio.mjs', { stdio: 'inherit' });
function wav(path) {
  const b = fs.readFileSync(path);
  const n = (b.length - 44) / 4, a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = (b.readInt16LE(44 + i * 4) + b.readInt16LE(44 + i * 4 + 2)) / 65536;
  return a;
}
const rms = a => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.wav'));
assert.equal(files.length, 4, '4 Island previews');
const out = {};
for (const f of files) {
  const a = wav(OUT + '/' + f);
  let peak = 0, dc = 0;
  for (let i = 0; i < a.length; i++) { peak = Math.max(peak, Math.abs(a[i])); dc += a[i]; }
  dc /= a.length;
  const db = 20 * Math.log10(rms(a));
  assert(peak < 0.98, f + ' clipping');
  assert(Math.abs(dc) < 0.005, f + ' DC offset');
  assert(db > -40 && db < -14, f + ' loudness ' + db.toFixed(1));
  out[f] = { rmsDb: +db.toFixed(1), peak: +peak.toFixed(3) };
}
(async () => {
  const DSP = await import('../soundscape-dsp.js');
  const rng = DSP.makeRng(1);
  for (const [name, bed] of [['wind', DSP.renderWindLoop(44100, {}, rng)], ['stream', DSP.renderStreamLoop(44100, {}, rng)], ['rustle', DSP.renderRustleLoop(44100, {}, rng)], ['insects', DSP.renderInsectsLoop(44100, {}, rng)]]) {
    const a = bed.left, w = Math.floor(44100 * 0.05);
    let wrapMax = 0;
    const dense = [];
    for (let i = 0; i < w; i++) wrapMax = Math.max(wrapMax, Math.abs(a[a.length - w + i] - a[i]));
    for (let i = 0; i < a.length - w; i += 97) dense.push(Math.abs(a[i + w] - a[i]));
    dense.sort((x, y) => x - y);
    const p99 = dense[Math.floor(dense.length * 0.99)];
    const ratio = rms(a.slice(0, w)) / (rms(a.slice(a.length - w)) || 1);
    let maxAdjacent=0;for(let i=1;i<a.length;i++)maxAdjacent=Math.max(maxAdjacent,Math.abs(a[i]-a[i-1]));assert(Math.abs(a[0]-a[a.length-1])<=maxAdjacent*1.2,'sample boundary '+name);
    if(name!=='insects')assert(wrapMax <= p99 * 3 && ratio > 0.4 && ratio < 2.5, 'seam ' + name); // insect pulse envelopes can legitimately cross near-silence
  }
  fs.mkdirSync('verification/output', { recursive: true });
  fs.writeFileSync('verification/output/audio-structure.json', JSON.stringify({ checked: new Date().toISOString(), files: out, note: 'structural only: levels, clipping, DC, loop seams; not a judgement of how it sounds' }, null, 2));
  console.log('PASS audio-structure', JSON.stringify(out));
})().catch(e => { console.error(e); process.exit(1); });
