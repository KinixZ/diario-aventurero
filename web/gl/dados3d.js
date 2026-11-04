/* Dados 3D (three.js, MIT): se bajan solo la primera vez que alguien los usa.
   Dados3D.roll([{sides, value, color}], {text}) tira hasta 12 dados sobre la pantalla: rebotan y giran hasta quedar
   con la cara del resultado hacia arriba. El resultado lo decide el servidor (o lo que escribiste con dados físicos):
   aquí solo se anima. Devuelve una promesa que se cumple al terminar. */
import { WebGLRenderer, Scene, PerspectiveCamera, AmbientLight, DirectionalLight, Mesh, MeshStandardMaterial, MeshBasicMaterial, IcosahedronGeometry, OctahedronGeometry, TetrahedronGeometry,
  BoxGeometry, DodecahedronGeometry, BufferGeometry, Float32BufferAttribute, Vector3, Quaternion, CanvasTexture, PlaneGeometry, Group, SRGBColorSpace } from 'three';

const COLORS = { 4: '#3f8f5a', 6: '#e8e0cc', 8: '#3f6fb0', 10: '#8b3fb0', 12: '#c0702a', 20: '#a8222a', 100: '#555' };

/* Un d10: trapezoedro pentagonal (10 cometas) */
function d10Geo() {
  const T = [0, 1, 0], Bt = [0, -1, 0], h = 0.1, R = [];
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; R.push([Math.cos(a), i % 2 ? -h : h, Math.sin(a)]); }
  const tris = [], faces = [];
  for (let k = 0; k < 5; k++) {
    const a = R[2 * k], b = R[2 * k + 1], c = R[(2 * k + 2) % 10];
    tris.push([T, c, b], [T, b, a]); faces.push([T, a, b, c]);
    const d = R[(2 * k + 1) % 10], e = R[(2 * k + 2) % 10], f = R[(2 * k + 3) % 10];
    tris.push([Bt, d, e], [Bt, e, f]); faces.push([Bt, d, e, f]);
  }
  const pos = []; tris.forEach((t) => t.forEach((p) => pos.push(p[0], p[1], p[2])));
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const info = faces.map((f) => { const c = new Vector3(); f.forEach((p) => c.add(new Vector3(p[0], p[1], p[2]))); c.multiplyScalar(1 / 4); return { c, n: c.clone().normalize(), r: 0.42 }; });
  return { g, faces: info };
}
/* Las caras de un poliedro: triángulos agrupados por su normal */
function facesOf(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo, p = g.getAttribute('position'), map = new Map(), out = [];
  for (let i = 0; i < p.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(p, i), b = new Vector3().fromBufferAttribute(p, i + 1), c = new Vector3().fromBufferAttribute(p, i + 2);
    const n = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize(), key = n.toArray().map((v) => Math.round(v * 50)).join(',');
    let f = map.get(key); if (!f) { f = { n, pts: [] }; map.set(key, f); out.push(f); }
    f.pts.push(a, b, c);
  }
  return out.map((f) => { const u = []; f.pts.forEach((q) => { if (!u.some((x) => x.distanceTo(q) < 1e-4)) u.push(q); }); const c = new Vector3(); u.forEach((q) => c.add(q)); c.multiplyScalar(1 / u.length); return { c, n: f.n, r: Math.min(...u.map((q) => q.distanceTo(c))) }; });
}
const GEO = {};
function shape(sides) {
  if (GEO[sides]) return GEO[sides];
  let g;
  if (sides === 4) g = new TetrahedronGeometry(1.15); else if (sides === 6) g = new BoxGeometry(1.3, 1.3, 1.3); else if (sides === 8) g = new OctahedronGeometry(1.05);
  else if (sides === 12) g = new DodecahedronGeometry(1.0); else if (sides === 20) g = new IcosahedronGeometry(1.05); else return (GEO[sides] = d10Geo());
  return (GEO[sides] = { g, faces: facesOf(g) });
}
function label(text, ink) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = ink; x.font = `700 ${text.length > 2 ? 54 : 72}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68);
  if (text === '6' || text === '9') x.fillRect(44, 104, 40, 6);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
}
/* Un dado con sus números; `top` es la cara que debe quedar arriba */
function makeDie(sides, value, color) {
  const S = shape(sides), grp = new Group(), dark = sides === 6, base = new MeshStandardMaterial({ color: color || COLORS[sides] || '#a8222a', flatShading: true, roughness: 0.45, metalness: 0.15 });
  grp.add(new Mesh(S.g, base));
  const n = S.faces.length, ink = dark ? '#2b1d12' : '#fff6e0';
  let topFace = 0;
  S.faces.forEach((f, i) => {
    const v = sides === 10 ? (i === 9 ? 0 : i + 1) : i + 1;
    if ((sides === 10 ? v === value % 10 : v === value)) topFace = i;
    const sz = Math.max(0.35, f.r * (sides === 6 ? 1.0 : sides === 4 ? 1.1 : 1.25));
    const m = new Mesh(new PlaneGeometry(sz, sz), new MeshBasicMaterial({ map: label(String(sides === 10 ? v : v), ink), transparent: true, depthWrite: false }));
    m.position.copy(f.c).addScaledVector(f.n, 0.01); m.lookAt(f.c.clone().addScaledVector(f.n, 2)); grp.add(m);
  });
  if (value > n && sides !== 10) topFace = n - 1;
  return { grp, face: S.faces[topFace], rest: sides === 4 ? 0.4 : sides === 6 ? 0.65 : 0.8 };
}

let rd = null, scene = null, cam = null, cv = null, busy = Promise.resolve();
function setup() {
  if (rd) return true;
  try {
    cv = document.createElement('canvas'); cv.className = 'dice3d'; cv.setAttribute('aria-hidden', 'true');
    rd = new WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); rd.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    scene = new Scene(); cam = new PerspectiveCamera(40, 1, 0.1, 100); cam.position.set(0, 16, 7); cam.lookAt(0, 0, 0);
    scene.add(new AmbientLight(0xffffff, 0.75)); const L = new DirectionalLight(0xffffff, 1.6); L.position.set(4, 12, 6); scene.add(L);
    return true;
  } catch (e) { rd = null; return false; }
}
const ease = (t) => 1 - Math.pow(1 - t, 3);
function roll(list, o = {}) {
  busy = busy.then(() => new Promise((done) => {
    if (!setup()) { done(false); return; }
    document.body.appendChild(cv); const W = window.innerWidth, H = window.innerHeight; rd.setSize(W, H, false); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cam.aspect = W / H; cam.updateProjectionMatrix();
    const dice = list.slice(0, 12).map((d, i, all) => {
      const D = makeDie(d.sides, d.value, d.color), up = new Vector3(0, 0.92, 0.39).normalize();
      const q1 = new Quaternion().setFromUnitVectors(D.face.n.clone().normalize(), up), yaw = new Quaternion().setFromAxisAngle(up, (Math.random() - 0.5) * 1.2);
      const n = all.length, cols = Math.min(n, 6), row = Math.floor(i / cols), col = i % cols, gap = 2.4;
      const fx = (col - (Math.min(cols, n - row * cols) - 1) / 2) * gap, fz = (row - (Math.ceil(n / cols) - 1) / 2) * gap;
      const sx = -9 - Math.random() * 3, sz = 5 + Math.random() * 3;
      D.grp.scale.setScalar(W < 600 ? 0.85 : 1); scene.add(D.grp);
      return { ...D, qF: yaw.multiply(q1), axis: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), spin: 6 + Math.random() * 6, from: new Vector3(sx, 4, sz), to: new Vector3(fx, D.rest, fz), delay: i * 70 };
    });
    let tip = null;
    if (o.text) { tip = document.createElement('div'); tip.className = 'dice3d-tip'; tip.textContent = o.text; document.body.appendChild(tip); }
    const T0 = performance.now(), DUR = 1300, HOLD = o.hold || 1300;
    const frame = (now) => {
      let all = true;
      dice.forEach((d) => {
        const t = Math.max(0, Math.min(1, (now - T0 - d.delay) / DUR)), e = ease(t); if (t < 1) all = false;
        const p = new Vector3().lerpVectors(d.from, d.to, e); p.y = d.rest + Math.abs(Math.sin(t * Math.PI * 3)) * 3.2 * Math.pow(1 - t, 2); d.grp.position.copy(p);
        d.grp.quaternion.copy(d.qF).multiply(new Quaternion().setFromAxisAngle(d.axis, d.spin * Math.pow(1 - e, 2) * Math.PI));
      });
      rd.render(scene, cam);
      if (!all) { requestAnimationFrame(frame); return; }
      if (tip) tip.classList.add('on');
      setTimeout(() => { cv.classList.add('out'); if (tip) tip.classList.add('out'); setTimeout(() => { dice.forEach((d) => { scene.remove(d.grp); d.grp.traverse((m) => { if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } }); }); cv.remove(); cv.classList.remove('out'); if (tip) tip.remove(); done(true); }, 350); }, HOLD);
    };
    requestAnimationFrame(frame);
  }));
  return busy;
}
window.Dados3D = { roll };
