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
    - 20 * Math.exp(-(((x - 58) / 20) ** 2))
    - 16 * Math.exp(-(((x + 66) / 17) ** 2));
}
const VOLCANO = { x: 20, z: 300, h: 190, r: 235 };
export function heightAt(x, z) {
  const d = z - shoreAt(x);
  let h;
  if (d < 0) h = Math.max(-3, d * 0.08) - 0.05;
  else h = Math.min(d, 16) * 0.085 + smooth(14, 70, d) * 5.5;
  h += (Math.exp(-(((x - 58) / 17) ** 2) - (((z + 30) / 20) ** 2)) * 4.5 +
        Math.exp(-(((x + 66) / 15) ** 2) - (((z + 24) / 18) ** 2)) * 4.0) * (0.6 + fbm(x * 0.35, z * 0.35));
  if (d > 0) h += (fbm(x * 0.05, z * 0.05) - 0.5) * 9 * smooth(20, 160, d) + (vnoise(x * 0.6, z * 0.6) - 0.5) * 0.25 * smooth(2, 12, d);
  const dx = x - VOLCANO.x, dz = z - VOLCANO.z, r = Math.hypot(dx, dz);
  if (r < VOLCANO.r) {
    let c = VOLCANO.h * Math.pow(1 - r / VOLCANO.r, 1.7);
    c *= 1 + 0.032 * Math.sin(Math.atan2(dz, dx) * 13 + vnoise(x * 0.03, z * 0.03) * 6) * smooth(10, 120, VOLCANO.r - r);
    c -= 26 * (1 - smooth(0, 22, r));
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
  leaf1: hex("#3c6b40"), leaf2: hex("#55844f"), ash: hex("#85776a"), rock: hex("#4a3f38"), cap: hex("#a39688"),
};
function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

function terrainColor(x, z, h, ny) {
  const d = z - shoreAt(x);
  const n = vnoise(x * 0.9, z * 0.9);
  let c = mix3(C.sand1, C.sand2, n);
  c = mix3(C.wet, c, smooth(0, 3.2, d));                       // wet sand at the waterline
  const lush = smooth(20, 52, d) * (1 - smooth(55, 105, h)) * smooth(0.55, 0.85, ny);
  c = mix3(c, mix3(C.leaf1, C.leaf2, fbm(x * 0.08, z * 0.08)), lush);
  const high = smooth(50, 110, h);
  c = mix3(c, mix3(C.rock, C.ash, fbm(x * 0.1, z * 0.1)), high * (1 - lush * 0.6));
  c = mix3(c, C.cap, smooth(118, 138, h) * 0.55);
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
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  sea.frustumCulled = false;
  group.add(sea);
  const seaBase = sp.slice();

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
        const wash = (0.5 + 0.5 * Math.sin(t * 0.5 + k * 2.1 + x * 0.045)) * (1.1 + k * 0.5) + k * 1.1;
        const edge = shoreAt(x) - wash;
        const w = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(x * 0.2 + k * 3 + t * 0.7));
        pa.setXYZ(i * 2, x, 0.07, edge);
        pa.setXYZ(i * 2 + 1, x, 0.07, edge - w);
      }
      pa.needsUpdate = true;
      m.material.opacity = 0.62 - k * 0.14;
    });
  }

  /* sea stacks and boulders: dark basalt, placed round the whole horizon */
  const rocks = new THREE.Group();
  const stacks = [
    [-34, -58, 5, 2.4], [-70, -96, 8, 3.2], [18, -120, 4, 3.0], [96, -80, 6, 2.6], [-128, -40, 5, 2.2],
    [150, -30, 7, 2.2], [52, -64, 3, 2.0], [-18, -150, 9, 2.8], [-200, -90, 12, 2.5], [210, -110, 10, 2.4],
  ];
  for (const [x, z, s, tall] of stacks) {
    const m = new THREE.Mesh(rockGeometry(rng, tall), new THREE.MeshBasicMaterial({ vertexColors: true }));
    m.position.set(x, Math.max(0, heightAt(x, z)) - s * 0.25, z);
    m.scale.set(s, s, s * 0.9); m.rotation.y = rng() * 6.28;
    rocks.add(m);
  }
  for (let i = 0; i < 26; i++) {
    const x = (rng() - 0.5) * 220, z = shoreAt(x) + 1 + rng() * 9, s = 0.35 + rng() * 0.9;
    if (Math.abs(x) < 4) continue;
    const m = new THREE.Mesh(rockGeometry(rng, 0.75), new THREE.MeshBasicMaterial({ vertexColors: true }));
    m.position.set(x, heightAt(x, z) + s * 0.1, z); m.scale.set(s, s, s); m.rotation.y = rng() * 6.28;
    rocks.add(m);
  }
  group.add(rocks);

  /* jungle: instanced canopy clumps on the slopes above the beach */
  const blobGeo = bakeFlat(new THREE.IcosahedronGeometry(1, 1), [1, 1, 1], rng, 0.16);
  const trees = [];
  for (let tries = 0; tries < 9000 && trees.length < 1400; tries++) {
    const x = (rng() - 0.5) * 520, z = rng() * 360;
    const d = z - shoreAt(x), h = heightAt(x, z);
    if (d < 34 || h > 70 || Math.hypot(x, z) < 22) continue;
    const sl = Math.abs(heightAt(x + 3, z) - h) + Math.abs(heightAt(x, z + 3) - h);
    if (sl > 9) continue;
    if (fbm(x * 0.05 + 9, z * 0.05) < 0.34) continue;                   // clearings
    trees.push([x, h, z, 1.9 + rng() * 2.6]);
  }
  const canopy = new THREE.InstancedMesh(blobGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), trees.length);
  const dummy = new THREE.Object3D(), tc = new THREE.Color();
  trees.forEach(([x, h, z, s], i) => {
    dummy.position.set(x, h + s * 0.55, z); dummy.scale.set(s, s * 0.62, s); dummy.rotation.y = rng() * 6.28; dummy.updateMatrix();
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

  const surf = [], rippleAmp = 0.035;
  function update(tA, camera) {
    for (let v = 0; v < sp.length / 3; v++) {
      const x = seaBase[v * 3], z = seaBase[v * 3 + 2];
      sp[v * 3 + 1] = (Math.sin(x * 0.045 + tA * 0.7) + Math.sin(z * 0.06 - tA * 0.55) + Math.sin((x + z) * 0.11 + tA * 1.1) * 0.5) * rippleAmp;
    }
    seaGeo.attributes.position.needsUpdate = true;
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
