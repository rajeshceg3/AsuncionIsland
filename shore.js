/* The black-sand shore as a real 3D place.
   The viewer stands on the beach at the origin. Sea lies ahead (-z), the island
   rises behind (+z) to the volcano, and the two headlands sit left and right.
   Everything here is geometry placed around the viewer, not layered cutouts. */

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(ix, iz) { let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;

/* coast: a gentle cove with a rocky point on each side, curving inland far out */
export function shoreAt(x) {
  return -9 + 0.0006 * x * x
    + 1.3 * Math.sin(x * 0.11 + 0.7) + 0.9 * Math.sin(x * 0.29 + 2.1) + 1.6 * (vnoise(x * 0.07, 3.3) - 0.5)
    - 20 * Math.exp(-(((x - 58) / 20) ** 2))
    - 16 * Math.exp(-(((x + 66) / 17) ** 2));
}
const VOLCANO = { x: 20, z: 320, h: 165, r: 250 };
export function heightAt(x, z) {
  const d = z - shoreAt(x);
  let h;
  if (d < 0) h = Math.max(-3, d * 0.08) - 0.05;
  else h = Math.min(d, 10) * 0.09 + smooth(8, 80, d) * 7 + smooth(10, 45, d) * (fbm(x * 0.13, z * 0.13) - 0.45) * 5;
  /* sources: Asuncion's steep side ends in high sea cliffs, the gentler side in low ones.
     Right point is the high cliff, left point the low one. */
  h += Math.exp(-(((x - 58) / 15) ** 2) - (((z + 30) / 26) ** 2)) * (13 + 9 * fbm(x * 0.2, z * 0.2));
  h += Math.exp(-(((x + 66) / 14) ** 2) - (((z + 24) / 20) ** 2)) * (4.5 + 3 * fbm(x * 0.3, z * 0.3));
  if (d > 0) {
    h += (fbm(x * 0.05, z * 0.05) - 0.5) * 9 * smooth(20, 160, d) + (vnoise(x * 0.6, z * 0.6) - 0.5) * 0.45 * smooth(2, 12, d);
    /* lava-flow ridges running down from the cone */
    const ang = Math.atan2(z - VOLCANO.z, x - VOLCANO.x);
    const flow = Math.pow(0.5 + 0.5 * Math.sin(ang * 34 + fbm(x * 0.02, z * 0.02) * 9), 2);
    h += flow * 2.6 * smooth(14, 90, d);
  }
  const dx = x - VOLCANO.x, dz = z - VOLCANO.z, r = Math.hypot(dx, dz);
  if (r < VOLCANO.r) {
    let c = VOLCANO.h * Math.pow(1 - r / VOLCANO.r, 1.55);
    c *= 1 + 0.03 * Math.sin(Math.atan2(dz, dx) * 11 + vnoise(x * 0.03, z * 0.03) * 6) * smooth(60, 190, r) * (1 - smooth(200, 245, r));
    c -= 22 * (1 - smooth(0, 26, r));
    h += c;
  }
  return h;
}

function lightShade(nx, ny, nz) {
  const L = [-0.42, 0.62, -0.66];
  const k = Math.hypot(...L);
  const dot = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / k);
  return 0.6 + 0.62 * dot;
}
/* vertex colours are read as linear light, so convert the sRGB palette once */
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const hex = (s) => { const n = parseInt(s.slice(1), 16); return [lin((n >> 16) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)]; };
const C = {
  wet: hex("#15120f"), sand1: hex("#26211e"), sand2: hex("#38312c"),
  leaf1: hex("#4d6a3a"), leaf2: hex("#7b8a49"), ash: hex("#4b423b"), rock: hex("#4a3f38"), cap: hex("#7a6e63"), lava: hex("#2d2825"), rubble: hex("#443b35"),
};
function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

function terrainColor(x, z, h, ny) {
  const d = z - shoreAt(x);
  const n = vnoise(x * 0.9, z * 0.9);
  let c = mix3(C.sand1, C.sand2, n);
  c = mix3(C.wet, c, smooth(0, 3.2, d));                       // wet sand at the waterline
  /* sources: lava rubble runs from shore to peak on the gentler sides, with scrub, fern and
     low grass in patches. Mostly dark, patched green. */
  const rub = smooth(7, 22, d);
  c = mix3(c, mix3(C.rubble, C.lava, fbm(x * 0.2, z * 0.2)), rub * 0.9);
  const patch = smooth(0.42, 0.62, fbm(x * 0.045 + 5, z * 0.045 + 2));
  const lush = smooth(14, 40, d) * (1 - smooth(60, 120, h)) * smooth(0.5, 0.8, ny) * patch;
  c = mix3(c, mix3(C.leaf1, C.leaf2, fbm(x * 0.09, z * 0.09)), lush);
  c = mix3(c, mix3(C.lava, C.ash, fbm(x * 0.1, z * 0.1)), smooth(40, 100, h) * (1 - lush * 0.7));
  c = mix3(c, C.cap, smooth(120, 150, h) * 0.45);
  if (d < 0) c = mix3(c, C.rock, smooth(0.3, 2.2, h));        // rock on the headlands
  return c;
}

function buildTerrain() {
  const NX = 240, NZ = 240, RX = 520, RZ = 650;
  const pos = new Float32Array((NX + 1) * (NZ + 1) * 3);
  const idx = [];
  const gx = (u) => RX * Math.sign(u) * u * u, gz = (u) => RZ * Math.sign(u) * u * u;
  let p = 0;
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = gx((i / NX) * 2 - 1), z = gz((j / NZ) * 2 - 1);
    pos[p++] = x; pos[p++] = heightAt(x, z); pos[p++] = z;
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, e = c + 1;
    idx.push(a, c, b, b, c, e);
  }
  const geo = new THREE_.BufferGeometry();
  geo.setAttribute("position", new THREE_.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal, col = new Float32Array(pos.length);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], h = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const c = terrainColor(x, z, h, nrm.getY(v));
    const s = lightShade(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
    col[v * 3] = Math.min(1, c[0] * s); col[v * 3 + 1] = Math.min(1, c[1] * s); col[v * 3 + 2] = Math.min(1, c[2] * s);
  }
  geo.setAttribute("color", new THREE_.BufferAttribute(col, 3));
  return new THREE_.Mesh(geo, new THREE_.MeshBasicMaterial({ vertexColors: true }));
}

function bakeFlat(geo, rgb, rng, jitter = 0.08) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const n = g.attributes.normal, cnt = g.attributes.position.count, col = new Float32Array(cnt * 3);
  for (let f = 0; f < cnt; f += 3) {
    const s = lightShade(n.getX(f), n.getY(f), n.getZ(f)) * (1 - jitter / 2 + rng() * jitter);
    for (let k = 0; k < 3; k++) { col[(f + k) * 3] = Math.min(1, rgb[0] * s); col[(f + k) * 3 + 1] = Math.min(1, rgb[1] * s); col[(f + k) * 3 + 2] = Math.min(1, rgb[2] * s); }
  }
  g.setAttribute("color", new THREE_.BufferAttribute(col, 3));
  return g;
}
function rockGeometry(rng, tall) {
  const g = new THREE_.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const seed = rng() * 100;
  for (let i = 0; i < p.count; i++) {
    /* displace by position, so shared corners move together and the faces stay joined */
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.82 + vnoise(x * 1.7 + seed, z * 1.7 + y * 1.3 + seed) * 0.36;
    p.setXYZ(i, x * k, y * k * tall, z * k);
  }
  return bakeFlat(g, C.rock, rng, 0.2);
}

let THREE_;
export function createShoreWorld(THREE, { birdGeometry, birdMaterial, plumeMaterial }) {
  THREE_ = THREE;
  const group = new THREE.Group();
  group.visible = false;
  const rng = rngFrom(20261105);

  group.add(buildTerrain());

  /* sea: a wide disc of shallow-to-deep colour, dense under the viewer */
  const SN = 110, SR = 1200;
  const sp = new Float32Array((SN + 1) * (SN + 1) * 3), sc = new Float32Array(sp.length), si = [];
  const shallow = hex("#7fb9b0"), deep = hex("#2f6f74");
  let q = 0;
  for (let j = 0; j <= SN; j++) for (let i = 0; i <= SN; i++) {
    const ux = (i / SN) * 2 - 1, uz = (j / SN) * 2 - 1;
    const x = SR * Math.sign(ux) * ux * ux, z = SR * Math.sign(uz) * uz * uz;
    sp[q * 3] = x; sp[q * 3 + 1] = 0; sp[q * 3 + 2] = z;
    const off = shoreAt(x) - z;
    const c = mix3(shallow, deep, smooth(2, 70, off));
    sc[q * 3] = c[0]; sc[q * 3 + 1] = c[1]; sc[q * 3 + 2] = c[2];
    q++;
  }
  for (let j = 0; j < SN; j++) for (let i = 0; i < SN; i++) {
    const a = j * (SN + 1) + i, b = a + 1, c = a + SN + 1, e = c + 1;
    si.push(a, c, b, b, c, e);
  }
  const seaGeo = new THREE.BufferGeometry();
  seaGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  seaGeo.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  seaGeo.setIndex(si);
  const seaMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const waveTime = { value: 0 };
  seaMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waveTime;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\n transformed.y += (sin(position.x * 0.045 + uTime * 0.7) + sin(position.z * 0.06 - uTime * 0.55) + sin((position.x + position.z) * 0.11 + uTime * 1.1) * 0.5) * 0.035;");
  };
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.frustumCulled = false;
  group.add(sea);

  /* foam: three bands that wash up and back along the real coastline */
  const FN = 160, FX0 = -140, FX1 = 140;
  const foams = [0, 1, 2].map((k) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array((FN + 1) * 2 * 3), 3));
    const ix = [];
    for (let i = 0; i < FN; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(ix);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.frustumCulled = false;
    group.add(m);
    return { m, k };
  });
  function updateFoam(t) {
    foams.forEach(({ m, k }) => {
      const pa = m.geometry.attributes.position;
      for (let i = 0; i <= FN; i++) {
        const x = mix(FX0, FX1, i / FN);
        const n1 = vnoise(x * 0.09 + k * 17, t * 0.12 + k * 5), n2 = vnoise(x * 0.31 + k * 3, t * 0.2 + 9);
        const wash = (0.5 + 0.5 * Math.sin(t * 0.5 + k * 2.1 + x * 0.045 + n1 * 5)) * (1.0 + k * 0.7) + k * 1.3 + (n1 - 0.5) * 1.6;
        const edge = shoreAt(x) - wash;
        const w = Math.max(0, (0.12 + 0.9 * n2 * n2 + 0.25 * k) * smooth(0.3, 0.52, n1 + k * 0.05));   // breaks into patches instead of a ruler line
        pa.setXYZ(i * 2, x, 0.07, edge);
        pa.setXYZ(i * 2 + 1, x, 0.07, edge - w);
      }
      pa.needsUpdate = true;
      m.material.opacity = 0.5 - k * 0.14;
    });
  }

  /* lava rubble: boulders in clusters along the shore and up the slope. Size and density rise
     toward the headlands, so the near ground is not a bare slab. */
  const rocks = new THREE.Group();
  const rockGeos = [0, 1, 2, 3].map(() => rockGeometry(rng, 0.7 + rng() * 0.5));
  const rockMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const rubbleSpots = [];
  for (let c = 0; c < 70; c++) {
    const x = (rng() - 0.5) * 300, d = 2 + Math.pow(rng(), 1.6) * 110;
    rubbleSpots.push([x, shoreAt(x) + d]);
  }
  for (const [cx, cz] of rubbleSpots) {
    const n = 3 + Math.floor(rng() * 9);
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() - 0.5) * 12, z = cz + (rng() - 0.5) * 12;
      const near = Math.hypot(x, z - 2);
      if (near < 7) continue;
      if (z < shoreAt(x) + 0.4) continue;
      const big = rng() < 0.12 && near > 18 ? 2.4 : 1;
      const s = (0.3 + rng() * 1.1) * big;
      const m = new THREE.Mesh(rockGeos[(rng() * 4) | 0], rockMat);
      m.position.set(x, heightAt(x, z) + s * 0.18, z); m.scale.set(s * (1 + rng() * 0.6), s, s * (1 + rng() * 0.4)); m.rotation.y = rng() * 6.28;
      rocks.add(m);
    }
  }
  /* big blocks that have fallen at the foot of each point */
  for (const [px, pz, k] of [[58, -8, 1], [-66, -6, 0.6], [48, -2, 0.8], [-58, 0, 0.5]]) {
    for (let i = 0; i < 5; i++) {
      const x = px + (rng() - 0.5) * 18, z = pz + (rng() - 0.5) * 12, s = (1.2 + rng() * 2.4) * k;
      if (z < shoreAt(x) - 1) continue;
      const m = new THREE.Mesh(rockGeos[(rng() * 4) | 0], rockMat);
      m.position.set(x, heightAt(x, z) + s * 0.15, z); m.scale.set(s, s * 0.9, s); m.rotation.y = rng() * 6.28;
      rocks.add(m);
    }
  }
  group.add(rocks);

  /* scrub and forest clumps: smooth, noise-shaped, shaded by height rather than by facet */
  const bushGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position;
    const seed = 41;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 0.78 + vnoise(x * 2.4 + seed, z * 2.4 + y * 2.1) * 0.5;
      p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    const n = g.attributes.normal, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const up = n.getY(i) * 0.5 + 0.5, s = 0.45 + 0.7 * up * up + 0.1 * vnoise(p.getX(i) * 5, p.getZ(i) * 5);
      col[i * 3] = s; col[i * 3 + 1] = s; col[i * 3 + 2] = s;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  })();
  const trees = [];
  for (let tries = 0; tries < 24000 && trees.length < 2600; tries++) {
    const x = (rng() - 0.5) * 560, z = rng() * 420;
    const d = z - shoreAt(x), h = heightAt(x, z);
    if (d < 11 || h > 78 || Math.hypot(x, z - 2) < 9) continue;
    const sl = Math.abs(heightAt(x + 3, z) - h) + Math.abs(heightAt(x, z + 3) - h);
    if (sl > 8) continue;
    const dens = fbm(x * 0.045 + 5, z * 0.045 + 2);                      // same patches as the ground colour
    if (dens < 0.46 + rng() * 0.2) continue;
    const near = d < 42;
    trees.push([x, h, z, near ? 0.7 + rng() * 1.3 : 1.6 + rng() * 2.6, near ? 0.8 : 0.95]);
  }
  const canopy = new THREE.InstancedMesh(bushGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), trees.length);
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  trees.forEach(([x, h, z, s, flat], i) => {
    dummy.position.set(x, h + s * 0.35, z); dummy.scale.set(s * 1.15, s * flat * 0.85, s * 1.15); dummy.rotation.y = rng() * 6.28; dummy.updateMatrix();
    canopy.setMatrixAt(i, dummy.matrix);
    const c = mix3(C.leaf1, C.leaf2, rng());
    tc.setRGB(c[0], c[1], c[2]); canopy.setColorAt(i, tc);
  });
  canopy.frustumCulled = false;
  group.add(canopy);

  /* a low sun over the water */
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 40), new THREE.MeshBasicMaterial({ color: "#fff6dc", transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
  sun.position.set(-170, 70, -760); sun.lookAt(0, 0, 0);
  group.add(sun);

  /* steam rising from the crater */
  const craterY = heightAt(VOLCANO.x, VOLCANO.z) + 4;
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), plumeMaterial());
    m.renderOrder = 2;
    group.add(m);
    puffs.push({ m, phase: i / 9, drift: 0.9 + rng() * 0.5 });
  }

  /* gulls circling in three dimensions */
  const gulls = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(birdGeometry, birdMaterial);
    group.add(m);
    gulls.push({ m, r: 22 + rng() * 60, h: 7 + rng() * 24, sp: (0.05 + rng() * 0.06) * (rng() < 0.5 ? -1 : 1), ph: rng() * 6.28, fl: 2.4 + rng() * 2, cz: -24 + rng() * 30 });
  }

  function update(tA, camera) {
    waveTime.value = tA;
    updateFoam(tA);
    for (const p of puffs) {
      const life = (tA * 0.05 * p.drift + p.phase) % 1;
      p.m.position.set(VOLCANO.x + life * 38, craterY + life * 52, VOLCANO.z - life * 6);
      p.m.scale.setScalar(5 + life * 26);
      p.m.quaternion.copy(camera.quaternion);
      p.m.material.opacity = 0.5 * Math.sin(life * Math.PI);
    }
    for (const g of gulls) {
      const a = tA * g.sp + g.ph;
      g.m.position.set(Math.sin(a) * g.r, g.h + Math.sin(a * 1.7) * 2, g.cz + Math.cos(a) * g.r);
      g.m.quaternion.copy(camera.quaternion);
      g.m.rotateZ(Math.cos(a) * 0.35);
      const flap = 1 + Math.sin(tA * g.fl + g.ph) * 0.28;
      g.m.scale.set(1.5, 1.5 * flap, 1);
    }
  }
  return { group, update, heightAt, shoreAt };
}
