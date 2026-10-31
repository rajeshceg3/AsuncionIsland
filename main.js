import * as THREE from "three";

/* ---------- tiny spring tween ---------- */
const springs = [];
function spring(obj, key, to, { stiffness = 60, damping = 11 } = {}) {
  let s = springs.find((e) => e.obj === obj && e.key === key);
  if (!s) { s = { obj, key, v: 0 }; springs.push(s); }
  s.to = to; s.stiffness = stiffness; s.damping = damping;
}
function stepSprings(dt) {
  for (let i = springs.length - 1; i >= 0; i--) {
    const s = springs[i];
    const x = s.obj[s.key];
    const F = -s.stiffness * (x - s.to) - s.damping * s.v;
    s.v += F * dt;
    s.obj[s.key] = x + s.v * dt;
    if (Math.abs(s.v) < 0.0004 && Math.abs(s.obj[s.key] - s.to) < 0.0004) {
      s.obj[s.key] = s.to; springs.splice(i, 1);
    }
  }
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpColor = (c, target, t) => { c.r = lerp(c.r, target.r, t); c.g = lerp(c.g, target.g, t); c.b = lerp(c.b, target.b, t); };

/* ---------- renderer ---------- */
const canvas = document.getElementById("island");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
camera.position.set(0, 0, 10);
scene.fog = new THREE.FogExp2(0xf6d3a3, 0.014);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.z = camera.aspect < 0.75 ? 13.5 : 10;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize); resize();

/* ---------- sky ---------- */
const skyMat = new THREE.ShaderMaterial({
  depthWrite: false,
  uniforms: { top: { value: new THREE.Color("#ffedd2") }, bottom: { value: new THREE.Color("#f6d3a3") } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.15, 0.85, vUv.y)), 1.0); }",
});
const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);

/* ---------- helpers ---------- */
function ridgeShape(width, base, amp, freq, phase) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, -30);
  for (let x = -width / 2; x <= width / 2; x += 2) {
    s.lineTo(x, base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.4);
  }
  s.lineTo(width / 2, -30);
  s.closePath();
  return s;
}
function layer(shape, color, z, opacity = 1) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  m.position.z = z;
  scene.add(m);
  return m;
}

/* ridges: far jungle wall, mid slope, near ground */
const ridgeFar = layer(ridgeShape(240, 0.4, 2.6, 0.045, 1.3), "#9a8874", -42);
const ridgeMid = layer(ridgeShape(230, -1.8, 2.0, 0.06, 3.7), "#7a6a56", -26);
const ridgeNear = layer(ridgeShape(220, -4.2, 1.5, 0.075, 5.2), "#5f5346", -15);

/* black sand foreground (shore) */
const sand = layer(ridgeShape(240, -5.6, 0.7, 0.05, 2.1), "#221e1b", -10, 0);

/* ocean band (shore) */
const waterGeo = new THREE.PlaneGeometry(240, 20, 1, 1);
const waterMat = new THREE.MeshBasicMaterial({ color: "#2f6f74", transparent: true, opacity: 0 });
const water = new THREE.Mesh(waterGeo, waterMat);
water.position.set(0, -3.2, -13);
scene.add(water);

/* foam lines (shore) */
const foamMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0 });
const foamMat2 = foamMat.clone();
const foamMat3 = foamMat.clone();
const foam1 = layer(ridgeShape(240, -1.4, 0.5, 0.5, 0.4), "#ffffff", -12.5, 0); foam1.material = foamMat;
const foam2 = layer(ridgeShape(240, -2.9, 0.4, 0.42, 2.2), "#ffffff", -12.4, 0); foam2.material = foamMat2;
const foam3 = layer(ridgeShape(240, -4.4, 0.35, 0.36, 4.4), "#ffffff", -12.3, 0); foam3.material = foamMat3;

/* ripples (tap the water) */
const ripples = [];
function ripple(x, y) {
  const g = new THREE.RingGeometry(0.42, 0.5, 48);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  m.position.set(x, y, -12.2); m.scale.y = 0.3;
  scene.add(m);
  ripples.push({ m, t: 0 });
}

/* ---------- the volcano ---------- */
function volcanoShape() {
  const s = new THREE.Shape();
  s.moveTo(-46, -30);
  s.lineTo(-46, -7.5);
  s.quadraticCurveTo(-22, -6.2, -8.5, 2.2);
  s.quadraticCurveTo(-4.4, 5.6, -2.6, 8.6);   /* left shoulder */
  s.lineTo(-1.5, 8.0);                          /* crater rim */
  s.lineTo(0, 8.35);
  s.lineTo(1.5, 8.0);
  s.lineTo(2.6, 8.6);                           /* right rim */
  s.quadraticCurveTo(4.4, 5.6, 8.5, 2.2);
  s.quadraticCurveTo(22, -6.2, 46, -7.5);
  s.lineTo(46, -30);
  s.closePath();
  return s;
}
const volcanoMat = new THREE.MeshBasicMaterial({ color: "#453b33", transparent: true, opacity: 1 });
const volcano = new THREE.Mesh(new THREE.ShapeGeometry(volcanoShape(), 32), volcanoMat);
volcano.position.set(0, 0, -44);
scene.add(volcano);

/* crater glow */
const glowMat = new THREE.MeshBasicMaterial({ color: "#ff7a2e", transparent: true, opacity: 0 });
const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), glowMat);
glow.position.set(0, 8.1, -43.8);
scene.add(glow);

/* steam plume */
const plume = [];
const plumeMat = () => new THREE.MeshBasicMaterial({ color: "#fff4e2", transparent: true, opacity: 0 });
for (let i = 0; i < 9; i++) {
  const p = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), plumeMat());
  scene.add(p);
  plume.push({ m: p, phase: i / 9, drift: 0.9 + Math.random() * 0.5 });
}

/* ---------- jungle canopy blobs ---------- */
const jungleMat = new THREE.MeshBasicMaterial({ color: "#3c6b40", transparent: true, opacity: 0 });
const jungle = new THREE.Group();
{
  let x = -24;
  while (x < 26) {
    const r = 1.4 + Math.random() * 2.2;
    const b = new THREE.Mesh(new THREE.CircleGeometry(r, 12), jungleMat);
    b.position.set(x, -3.4 + Math.random() * 1.6, -20);
    b.scale.y = 0.75;
    jungle.add(b);
    x += r * (0.9 + Math.random() * 0.7);
  }
}
scene.add(jungle);

/* ---------- birds ---------- */
function gullShape() {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.quadraticCurveTo(-0.45, 0.5, 0, 0.06);
  s.quadraticCurveTo(0.45, 0.5, 1, 0);
  s.quadraticCurveTo(0.45, 0.3, 0, -0.1);
  s.quadraticCurveTo(-0.45, 0.3, -1, 0);
  s.closePath();
  return new THREE.ShapeGeometry(s, 8);
}
const gull = gullShape();
const birdMat = new THREE.MeshBasicMaterial({ color: "#20242e", transparent: true, opacity: 0.25, side: THREE.DoubleSide });
const birds = [];
for (let i = 0; i < 14; i++) {
  const b = new THREE.Mesh(gull, birdMat);
  scene.add(b);
  birds.push({
    m: b,
    cx: -20 + Math.random() * 40, cy: 4 + Math.random() * 8,
    r: 3 + Math.random() * 6, speed: 0.25 + Math.random() * 0.3,
    phase: Math.random() * 6.28, flap: 2.2 + Math.random() * 2,
  });
}

/* ---------- stars ---------- */
const starGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 300; i++) pts.push((Math.random() - 0.5) * 170, Math.random() * 50 - 4, -50 + Math.random() * 18);
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
const starMat = new THREE.PointsMaterial({ color: "#fff7e6", size: 0.16, transparent: true, opacity: 0, sizeAttenuation: true });
scene.add(new THREE.Points(starGeo, starMat));

/* ---------- drifting motes (ash, spores, spray) ---------- */
const moteGeo = new THREE.BufferGeometry();
{
  const pts = [];
  for (let i = 0; i < 130; i++) pts.push((Math.random() - 0.5) * 90, (Math.random() - 0.5) * 26, -30 + Math.random() * 24);
  moteGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}
const moteMat = new THREE.PointsMaterial({ color: "#fff2dc", size: 0.22, transparent: true, opacity: 0.35, sizeAttenuation: true });
const motes = new THREE.Points(moteGeo, moteMat);
scene.add(motes);

/* ---------- chapters ---------- */
const CHAPTERS = [
  { skyTop: "#ffedd2", skyBot: "#f6d3a3", fog: ["#f6d3a3", 0.014], far: "#9a8874", mid: "#7a6a56", near: "#5f5346",
    volcano: 1, volcanoC: "#453b33", plume: 0.85, glow: 0.5, jungle: 0, sand: 0, water: 0, foam: 0,
    birds: 0.25, stars: 0, motes: ["#fff2dc", 0.3], night: false,
    caption: "The island is still being born.", whisper: "No roads, no voices. Only the mountain, breathing." },
  { skyTop: "#eef7ea", skyBot: "#d4ead9", fog: ["#d4ead9", 0.03], far: "#8ab48a", mid: "#5d8f5f", near: "#3c6b40",
    volcano: 0, volcanoC: "#4c5f4a", plume: 0, glow: 0, jungle: 0.9, sand: 0, water: 0, foam: 0,
    birds: 0.3, stars: 0, motes: ["#f4ffef", 0.5], night: false,
    caption: "The jungle keeps what the rain gives.", whisper: "Green on green on green." },
  { skyTop: "#fdf6e8", skyBot: "#cfe7e4", fog: ["#cfe7e4", 0.01], far: "#b9cdc6", mid: "#7d9a90", near: "#4c6660",
    volcano: 0.16, volcanoC: "#5e6a66", plume: 0.25, glow: 0, jungle: 0, sand: 1, water: 0.95, foam: 0.55,
    birds: 0.45, stars: 0, motes: ["#ffffff", 0.22], night: true,
    caption: "Black sand. White water. No footprints.", whisper: "The water answers every touch." },
  { skyTop: "#0a0f24", skyBot: "#1b2340", fog: ["#1b2340", 0.028], far: "#232c4e", mid: "#1d2542", near: "#161c33",
    volcano: 0.4, volcanoC: "#20263f", plume: 0.2, glow: 0.75, jungle: 0, sand: 0, water: 0.35, foam: 0.18,
    birds: 1, stars: 1, motes: ["#d8d2c0", 0.4], night: true,
    caption: "Ten thousand wings own the night.", whisper: "The island has never had a keeper." },
];
let chapter = 0;
const target = {
  skyTop: new THREE.Color(CHAPTERS[0].skyTop), skyBot: new THREE.Color(CHAPTERS[0].skyBot),
  fog: new THREE.Color(CHAPTERS[0].fog[0]), far: new THREE.Color(CHAPTERS[0].far),
  mid: new THREE.Color(CHAPTERS[0].mid), near: new THREE.Color(CHAPTERS[0].near),
  volcanoC: new THREE.Color(CHAPTERS[0].volcanoC), motes: new THREE.Color(CHAPTERS[0].motes[0]),
  fogN: CHAPTERS[0].fog[1], volcano: 1, plume: 0.85, glow: 0.5, jungle: 0, sand: 0,
  water: 0, foam: 0, birds: 0.25, stars: 0, motesO: 0.3,
};

/* ---------- chrome ---------- */
const veil = document.getElementById("veil");
const caption = document.getElementById("caption");
const whisper = document.getElementById("whisper");
const chrome = [...document.querySelectorAll(".chrome")];
const dots = [...document.querySelectorAll(".dot")];
let idleTimer, whisperTimer, shoreCueTimer, shoreCueFirst;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
function wakeChrome() {
  chrome.forEach((c) => c.classList.remove("idle"));
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => chrome.forEach((c) => c.classList.add("idle")), 4200);
}
function setChapter(i) {
  if (i === chapter) return;
  chapter = i;
  const c = CHAPTERS[i];
  target.skyTop.set(c.skyTop); target.skyBot.set(c.skyBot); target.fog.set(c.fog[0]);
  target.far.set(c.far); target.mid.set(c.mid); target.near.set(c.near);
  target.volcanoC.set(c.volcanoC); target.motes.set(c.motes[0]);
  target.fogN = c.fog[1]; target.volcano = c.volcano; target.plume = c.plume;
  target.glow = c.glow; target.jungle = c.jungle; target.sand = c.sand;
  target.water = c.water; target.foam = c.foam; target.birds = c.birds;
  target.stars = c.stars; target.motesO = c.motes[1];
  document.body.classList.toggle("night", c.night);
  dots.forEach((d, j) => d.classList.toggle("active", j === i));
  caption.classList.remove("show"); whisper.classList.remove("show");
  clearTimeout(whisperTimer);
  clearTimeout(shoreCueFirst); clearInterval(shoreCueTimer);
  if (i === 2 && !reduceMotion) {
    shoreCueFirst = setTimeout(() => ripple(-3 + Math.random() * 6, 0.1 + Math.random() * 0.7), 2400);
    shoreCueTimer = setInterval(() => ripple(-6 + Math.random() * 12, 0.0 + Math.random() * 1.2), 5200);
  }
  setTimeout(() => { caption.textContent = c.caption; caption.classList.add("show"); }, 1100);
  whisperTimer = setTimeout(() => { whisper.textContent = c.whisper; whisper.classList.add("show"); }, 3200);
  wakeChrome();
}
dots.forEach((d, i) => d.addEventListener("click", () => setChapter(i)));

/* ---------- pointer ---------- */
let px = 0, py = 0, dragging = false, moved = 0, downX = 0, downY = 0;
addEventListener("pointerdown", (e) => { dragging = true; moved = 0; downX = e.clientX; downY = e.clientY; wakeChrome(); });
addEventListener("pointermove", (e) => {
  if (dragging) { moved += Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY); }
  px = (e.clientX / innerWidth) * 2 - 1;
  py = (e.clientY / innerHeight) * 2 - 1;
});
addEventListener("pointerup", (e) => {
  dragging = false;
  if (moved < 12 && chapter === 2 && e.clientY > innerHeight * 0.4 && e.clientY < innerHeight * 0.86) {
    const v = new THREE.Vector3((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1), 0.5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (-13 - camera.position.z) / dir.z;
    const hit = camera.position.clone().add(dir.multiplyScalar(t));
    ripple(hit.x, hit.y);
  }
});

/* ---------- loop ---------- */
const clock = new THREE.Clock();
let camX = 0, camY = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const tA = reduceMotion ? 0 : t;

  camX = lerp(camX, reduceMotion ? 0 : px * 1.1, 1 - Math.exp(-3.2 * dt));
  camY = lerp(camY, reduceMotion ? 0 : -py * 0.5, 1 - Math.exp(-3.2 * dt));
  camera.position.x = camX; camera.position.y = camY + 0.4;
  camera.lookAt(camX * 0.4, camY * 0.3 + 0.6, -20);

  const k = 1 - Math.exp(-1.6 * dt);
  lerpColor(skyMat.uniforms.top.value, target.skyTop, k);
  lerpColor(skyMat.uniforms.bottom.value, target.skyBot, k);
  lerpColor(scene.fog.color, target.fog, k);
  scene.fog.density = lerp(scene.fog.density, target.fogN, k);
  lerpColor(ridgeFar.material.color, target.far, k);
  lerpColor(ridgeMid.material.color, target.mid, k);
  lerpColor(ridgeNear.material.color, target.near, k);
  lerpColor(volcanoMat.color, target.volcanoC, k);
  lerpColor(moteMat.color, target.motes, k);
  volcanoMat.opacity = lerp(volcanoMat.opacity, target.volcano, k);
  jungleMat.opacity = lerp(jungleMat.opacity, target.jungle, k);
  sand.material.opacity = lerp(sand.material.opacity, target.sand, k);
  waterMat.opacity = lerp(waterMat.opacity, target.water, k);
  foamMat.opacity = lerp(foamMat.opacity, target.foam, k);
  foamMat2.opacity = lerp(foamMat2.opacity, target.foam * 0.7, k);
  foamMat3.opacity = lerp(foamMat3.opacity, target.foam * 0.5, k);
  starMat.opacity = lerp(starMat.opacity, target.stars, k);
  birdMat.opacity = lerp(birdMat.opacity, target.birds, k);
  moteMat.opacity = lerp(moteMat.opacity, target.motesO, k);
  glowMat.opacity = lerp(glowMat.opacity, target.glow * (0.7 + Math.sin(tA * 2.1) * 0.3), k);

  /* steam plume: rise, drift with wind, fade, loop */
  for (const p of plume) {
    const life = (tA * 0.09 * p.drift + p.phase) % 1;
    p.m.position.set(life * 7.5, 8.2 + life * 6.5, -43.7);
    const s = 0.4 + life * 2.6;
    p.m.scale.setScalar(s);
    p.m.material.opacity = target.plume * Math.sin(life * Math.PI) * 0.55;
  }

  /* foam lines breathe in and out */
  foam1.position.x = Math.sin(tA * 0.5) * 3;
  foam2.position.x = Math.sin(tA * 0.5 + 2.1) * 4;
  foam3.position.x = Math.sin(tA * 0.45 + 4.2) * 5;
  foam1.position.y = Math.sin(tA * 0.8) * 0.25;
  foam2.position.y = Math.sin(tA * 0.7 + 1.4) * 0.2;

  /* birds wheel */
  for (const b of birds) {
    const a = tA * b.speed + b.phase;
    const x = b.cx + Math.cos(a) * b.r;
    const y = b.cy + Math.sin(a * 0.9) * b.r * 0.32;
    b.m.position.set(x, y, -30);
    b.m.rotation.z = Math.cos(a) * 0.35;
    const flap = 1 + Math.sin(tA * b.flap + b.phase) * 0.28;
    b.m.scale.set(0.62, 0.62 * flap, 1);
  }

  if (!reduceMotion) {
    const pos = moteGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + dt * (0.35 + (i % 5) * 0.08);
      if (x > 46) x = -46;
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  }

  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    const s = 1 + r.t * 7;
    r.m.scale.set(s, s * 0.3, 1);
    r.m.material.opacity = Math.max(0, 0.85 - r.t * 0.75);
    if (r.t > 1.2) { scene.remove(r.m); r.m.geometry.dispose(); ripples.splice(i, 1); }
  }

  stepSprings(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

/* ---------- veil ---------- */
setTimeout(() => {
  veil.classList.add("gone");
  dots[0].classList.add("active");
  caption.textContent = CHAPTERS[0].caption;
  setTimeout(() => caption.classList.add("show"), 900);
  whisper.textContent = CHAPTERS[0].whisper;
  whisperTimer = setTimeout(() => whisper.classList.add("show"), 3000);
  wakeChrome();
}, 2100);
