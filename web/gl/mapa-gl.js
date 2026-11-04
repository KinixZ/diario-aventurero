/* ==================== MOTOR DEL MAPA (PixiJS / WebGL) ====================
   Lo carga Gfx.loadGL() solo cuando se abre un mapa. Expone window.MapaGL.create(canvas, opts).
   mapas.js decide qué se ve (fichas, niebla, quién es dueño de qué) y le pasa una "escena" ya resuelta;
   este módulo solo dibuja, y conserva entre cuadros lo que no cambió (cuadrícula, trazos, fichas, niebla).
   Todo lo del mundo se dibuja en casillas: el contenedor `world` se escala con el zoom (v.s px por casilla).
   Niebla con visión: una textura aparte (RenderTexture) donde se pinta lo no descubierto y la penumbra de lo descubierto,
   se borran (blend «erase») los polígonos que ve el grupo y, si el aparato aguanta, se suaviza el borde. Solo se rehace
   cuando cambia la vista o lo descubierto, no en cada cuadro. */
import { Application, BlurFilter, Container, Graphics, RenderTexture, Sprite, Text, Texture } from 'pixi.js';

const PAPER = 0xf3e9d2, OUT = 0x1c1512;
const TEXTS = { 0.06: 0.7, 0.14: 1.1, 0.32: 1.8 };
const TXT_BASE = 72, LBL_BASE = 28;

async function create(canvas, opts = {}) {
  const app = new Application();
  await app.init({
    canvas, width: opts.width || canvas.clientWidth || 360, height: opts.height || canvas.clientHeight || 400,
    resolution: opts.resolution || 1, autoDensity: true, antialias: opts.antialias !== false,
    background: OUT, preference: 'webgl', autoStart: false, sharedTicker: false,
    powerPreference: opts.power || 'default', failIfMajorPerformanceCaveat: false,
  });
  app.ticker.stop();
  const need = typeof opts.onNeed === 'function' ? opts.onNeed : () => {};

  /* Capas del escenario, de abajo hacia arriba */
  const world = new Container(), screen = new Container();
  const paper = new Graphics(), bg = new Sprite(), grid = new Graphics(), strokesBox = new Container(), wallInk = new Graphics();
  const tokLow = new Container(), fog = new Sprite(), tokHigh = new Container(), border = new Graphics(), top = new Container();
  const preview = new Graphics(), marks = new Graphics(), wallTech = new Graphics(), ghostBox = new Container();
  top.addChild(wallTech, marks, preview, ghostBox);
  world.addChild(paper, bg, grid, strokesBox, wallInk, tokLow, fog, tokHigh, border, top);
  app.stage.addChild(world, screen);
  bg.visible = false; fog.visible = false;

  const imgCache = new Map();   // url → {img, tex, circle}
  const assetTex = new Map();   // imagen de objeto → textura
  const strokeObjs = new Map(); // id → display object
  const layerBoxes = new Map(); // layer id → Container
  const tokObjs = new Map();    // id → {box, sig}
  const labelPool = [];
  let paperKey = '', gridKey = '', strokeKey = '', fogKey = '', bgKey = '', wallKey = '', visKey = '', fogCanvas = null, fogTex = null, dead = false;
  // composición de la niebla con visión
  const fogComp = new Container(), fogPad = new Graphics(), fogBase = new Sprite(), fogCut = new Graphics(), blurSp = new Sprite();
  fogCut.blendMode = 'erase'; fogComp.addChild(fogPad, fogBase, fogCut);
  let fogRT = null, fogRT2 = null, blurF = null;

  /* ---------- Imágenes ---------- */
  function image(url) {
    let e = imgCache.get(url);
    if (e) return e.ready ? e : null;
    e = { ready: false, img: new Image(), tex: null, circle: null };
    imgCache.set(url, e);
    e.img.decoding = 'async';
    e.img.onload = () => { if (dead) return; e.ready = true; need(); };
    e.img.onerror = () => { e.failed = true; };
    e.img.src = url;
    return null;
  }
  function texOf(url) { const e = image(url); if (!e) return null; if (!e.tex) e.tex = Texture.from(e.img); return e.tex; }
  /* Retrato recortado en círculo, una vez por imagen (más barato que una máscara por ficha) */
  function circleOf(url) {
    const e = image(url); if (!e) return null;
    if (!e.circle) {
      const n = 160, cv = document.createElement('canvas'); cv.width = cv.height = n;
      const c = cv.getContext('2d'), im = e.img, k = Math.max(n / im.naturalWidth, n / im.naturalHeight);
      c.beginPath(); c.arc(n / 2, n / 2, n / 2, 0, Math.PI * 2); c.clip();
      c.drawImage(im, (n - im.naturalWidth * k) / 2, (n - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
      e.circle = Texture.from(cv);
    }
    return e.circle;
  }

  /* ---------- Papel, fondo y cuadrícula (solo cambian con el mapa) ---------- */
  function syncPaper(m) {
    const k = m.cols + 'x' + m.rows;
    if (k !== paperKey) {
      paperKey = k;
      paper.clear().rect(0, 0, m.cols, m.rows).fill(PAPER);
      border.clear().rect(0, 0, m.cols, m.rows).stroke({ color: 0x3c2814, alpha: 0.6, width: 1, pixelLine: true });
    }
    const bk = (m.bgUrl || '') + '|' + m.cols + 'x' + m.rows;
    const t = m.bgUrl ? texOf(m.bgUrl) : null;
    if (t) { if (bgKey !== bk) { bg.texture = t; bgKey = bk; } bg.visible = true; bg.width = m.cols; bg.height = m.rows; bg.alpha = m.bgOp == null ? 1 : m.bgOp; }
    else { bg.visible = false; bgKey = ''; }
  }
  function syncGrid(m, v) {
    const k = m.grid + '|' + m.cols + 'x' + m.rows + '|' + (m.bgUrl ? 1 : 0);
    if (k !== gridKey) {
      gridKey = k; grid.clear();
      if (m.grid === 'square') {
        for (let x = 0; x <= m.cols; x++) grid.moveTo(x, 0).lineTo(x, m.rows);
        for (let y = 0; y <= m.rows; y++) grid.moveTo(0, y).lineTo(m.cols, y);
      } else if (m.grid === 'hex') {
        const r = 1 / Math.sqrt(3), dy = 1.5 * r;
        for (let row = -1; row * dy <= m.rows + 1; row++) for (let col = -1; col <= m.cols + 1; col++) {
          const cx = col + (row % 2 ? 1 : 0.5), cy = row * dy + r, pts = [];
          for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 90); pts.push(Math.max(0, Math.min(m.cols, cx + r * Math.cos(a))), Math.max(0, Math.min(m.rows, cy + r * Math.sin(a)))); }
          grid.poly(pts, true);
        }
      }
      if (m.grid !== 'none') grid.stroke(m.bgUrl ? { color: 0x1e140a, alpha: 0.35, width: 1, pixelLine: true } : { color: 0x503a22, alpha: 0.28, width: 1, pixelLine: true });
    }
    grid.visible = m.grid !== 'none' && v.s >= 5;
  }

  /* ---------- Trazos: uno por id, se crean una sola vez ---------- */
  /* Caja girada de un elemento (para marcar lo que se borra o se elige) */
  function rbox(k) {
    const p = k.pts;
    if (k.k === 'rect') return { cx: (p[0] + p[2]) / 2, cy: (p[1] + p[3]) / 2, w: Math.abs(p[2] - p[0]), h: Math.abs(p[3] - p[1]), r: k.r || 0 };
    if (k.k === 'text') { const fs = k.fs || TEXTS[k.w] || k.w * 6; return { cx: p[0], cy: p[1], w: Math.max(fs, String(k.t || '').length * fs * 0.56), h: fs * 1.25, r: k.r || 0 }; }
    return { cx: p[0], cy: p[1], w: k.s || 1, h: k.h || k.s || 1, r: k.r || 0 };
  }
  function polyOf(b) { const a = (b.r || 0) * Math.PI / 180, co = Math.cos(a), si = Math.sin(a), out = []; [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([qx, qy]) => { const dx = qx * b.w / 2, dy = qy * b.h / 2; out.push(b.cx + dx * co - dy * si, b.cy + dx * si + dy * co); }); return out; }
  function strokeShape(g, k, color) {
    const p = k.pts, c = color || k.c;
    if (k.k === 'rect') {
      if (color || k.r) { const pl = polyOf(rbox(k)); if (k.f) g.poly(pl, true).fill({ color: c, alpha: 0.35 }); g.poly(pl, true).stroke({ width: k.w, color: c, join: 'miter' }); return g; }
      const x = Math.min(p[0], p[2]), y = Math.min(p[1], p[3]), w = Math.abs(p[0] - p[2]), h = Math.abs(p[1] - p[3]);
      if (k.f) g.rect(x, y, w, h).fill({ color: c, alpha: 0.35 });
      g.rect(x, y, w, h).stroke({ width: k.w, color: c, join: 'miter' });
    } else if (k.k === 'text' || k.k === 'asset' || k.k === 'img') {
      g.poly(polyOf(rbox(k)), true).fill({ color: c || 0xff3b30, alpha: 0.6 });
    } else if (p.length === 2) {
      g.circle(p[0], p[1], Math.max(0.05, k.w / 2)).fill(c);
    } else {
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      g.stroke({ width: k.w, color: c, cap: 'round', join: 'round' });
    }
    return g;
  }
  function strokeObj(k, assetImg) {
    if (k.k === 'asset' || k.k === 'img') {
      const im = assetImg ? assetImg(k) : null;
      if (!im) { const ph = new Container(); ph._pending = true; return ph; }
      let t = assetTex.get(im); if (!t) { t = Texture.from(im); assetTex.set(im, t); }
      const sp = new Sprite(t); sp.anchor.set(0.5); sp.width = k.s || 1; sp.height = k.h || k.s || 1; sp.position.set(k.pts[0], k.pts[1]); sp.rotation = (k.r || 0) * Math.PI / 180;
      return sp;
    }
    if (k.k === 'text') {
      const fs = k.fs || TEXTS[k.w] || k.w * 6;
      const t = new Text({ text: String(k.t || ''), resolution: 2, style: { fontFamily: 'Georgia, serif', fontWeight: '600', fontSize: TXT_BASE, fill: k.c, stroke: { color: 0xf3e9d2, alpha: 0.85, width: TXT_BASE / 6, join: 'round' } } });
      t.anchor.set(0.5); t.scale.set(fs / TXT_BASE); t.position.set(k.pts[0], k.pts[1]); t.rotation = (k.r || 0) * Math.PI / 180;
      return t;
    }
    return strokeShape(new Graphics(), k);
  }
  /* Clave de un trazo: cambia al editarlo (v) y durante la vista previa de un gesto (_p) */
  const okey = (s) => s.id + ':' + (s.v || 0) + (s._p ? ':p' + s._p : '');
  let pendingObjs = 0;
  function syncStrokes(m) {
    const k = m.id + '|' + m.strokes.length + '|' + (m.strokes.length ? m.strokes[m.strokes.length - 1].id : '') + '|' + m.layers.map((l) => l.id).join(',') + '|' + Object.keys(m.hid).filter((x) => m.hid[x]).join(',') + '|' + (m.rev || 0);
    if (k === strokeKey && !pendingObjs) return;
    strokeKey = k; pendingObjs = 0;
    const alive = new Set();
    m.strokes.forEach((s) => {
      const id = okey(s); alive.add(id); let o = strokeObjs.get(id);
      // un objeto cuya imagen no había llegado se rehace cuando ya está
      if (o && o._pending && m.asset && m.asset(s)) { o.destroy(); o = null; strokeObjs.delete(id); }
      if (!o) { o = strokeObj(s, m.asset); strokeObjs.set(id, o); }
      if (o._pending) pendingObjs++;
    });
    for (const [id, o] of strokeObjs) if (!alive.has(id)) { o.destroy(); strokeObjs.delete(id); }
    const seenL = new Set();
    strokesBox.removeChildren();
    m.layers.forEach((l) => {
      seenL.add(l.id);
      let box = layerBoxes.get(l.id); if (!box) { box = new Container(); layerBoxes.set(l.id, box); }
      box.removeChildren(); box.visible = !m.hid[l.id];
      strokesBox.addChild(box);
    });
    for (const [id, box] of layerBoxes) if (!seenL.has(id)) { box.destroy(); layerBoxes.delete(id); }
    m.strokes.forEach((s) => { const box = layerBoxes.get(s.l); if (box) box.addChild(strokeObjs.get(okey(s))); });
  }

  /* ---------- Niebla: una textura de cols × rows píxeles, uno por casilla ---------- */
  function syncFog(f, m) {
    if (!f || !f.on) { fog.visible = false; return; }
    const un = f.un == null ? (f.dm ? 0.5 : 1) : f.un, mem = f.mem || 0;
    const k = m.id + '|' + m.cols + 'x' + m.rows + '|' + f.key + '|' + (f.dm ? 1 : 0) + '|' + un + '|' + mem;
    if (k !== fogKey) {
      fogKey = k; visKey = '';
      if (!fogCanvas || fogCanvas.width !== m.cols || fogCanvas.height !== m.rows) {
        fogCanvas = document.createElement('canvas'); fogCanvas.width = m.cols; fogCanvas.height = m.rows;
        if (fogTex) fogTex.destroy(true);
        fogTex = Texture.from(fogCanvas); fogTex.source.scaleMode = 'nearest';
      }
      const c = fogCanvas.getContext('2d'), id = c.createImageData(m.cols, m.rows), d = id.data, a = Math.round(un * 255), am = Math.round(mem * 255), bits = f.bits;
      for (let i = 0, n = m.cols * m.rows; i < n; i++) {
        const dark = !((bits[i >> 3] >> (i & 7)) & 1), o = i * 4;
        d[o] = f.dm ? 12 : 11; d[o + 1] = 8; d[o + 2] = 6; d[o + 3] = dark ? a : am;
      }
      c.putImageData(id, 0, 0); fogTex.source.update();
    }
    if (!f.vis) { fog.texture = fogTex; fog.position.set(0, 0); fog.width = m.cols; fog.height = m.rows; fog.visible = true; return; }
    // con visión: se compone aparte, con un margen para que el suavizado no aclare los bordes del mapa
    const M = 2, big = Math.max(m.cols, m.rows) + M * 2, K = Math.max(3, Math.min(f.k || 12, Math.floor(2048 / big))), soft = !!f.soft;
    const vk = k + '|' + f.vis.key + '|' + K + '|' + (soft ? 1 : 0);
    if (vk !== visKey) {
      visKey = vk;
      const w = (m.cols + M * 2) * K, h = (m.rows + M * 2) * K;
      if (!fogRT || fogRT.width !== w || fogRT.height !== h) {
        if (fogRT) fogRT.destroy(true); if (fogRT2) { fogRT2.destroy(true); fogRT2 = null; }
        fogRT = RenderTexture.create({ width: w, height: h });
      }
      if (soft && !fogRT2) fogRT2 = RenderTexture.create({ width: w, height: h });
      fogPad.clear();
      if (!f.dm) { const e = M * K; fogPad.rect(0, 0, w, e).rect(0, h - e, w, e).rect(0, e, e, h - 2 * e).rect(w - e, e, e, h - 2 * e).fill({ color: OUT, alpha: 1 }); }
      fogBase.texture = fogTex; fogBase.position.set(M * K, M * K); fogBase.width = m.cols * K; fogBase.height = m.rows * K;
      fogCut.clear();
      for (const P of f.vis.polys) { if (P.length < 6) continue; const q = new Array(P.length); for (let i = 0; i < P.length; i++) q[i] = (P[i] + M) * K; fogCut.poly(q, true).fill({ color: 0xffffff, alpha: 1 }); }
      app.renderer.render({ container: fogComp, target: fogRT, clear: true });
      if (soft) {
        if (!blurF) blurF = new BlurFilter({ strength: 1, quality: 3 });
        blurF.strength = Math.max(1.5, K * 0.32); blurSp.texture = fogRT; blurSp.filters = [blurF];
        app.renderer.render({ container: blurSp, target: fogRT2, clear: true });
      }
      fog.texture = soft ? fogRT2 : fogRT;
    }
    fog.position.set(-M, -M); fog.width = m.cols + M * 2; fog.height = m.rows + M * 2; fog.visible = true;
  }

  /* ---------- Paredes: figuras sencillas que manda mapas.js (seg, door, dot, lock, arrow) ---------- */
  function doorPoly(q) {
    const L = Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) * 0.97, an = Math.atan2(q.b[1] - q.a[1], q.b[0] - q.a[0]) + (q.r || 0) * Math.PI / 180;
    const ux = Math.cos(an), uy = Math.sin(an), nx = -uy, ny = ux, h = q.w / 2, ax = q.a[0], ay = q.a[1];
    return [ax - nx * h, ay - ny * h, ax + ux * L - nx * h, ay + uy * L - ny * h, ax + ux * L + nx * h, ay + uy * L + ny * h, ax + nx * h, ay + ny * h];
  }
  function drawPrims(g, list, px) {
    for (const q of list) {
      const o = q.o == null ? 1 : q.o;
      if (q.p === 'seg') {
        const w = q.px ? q.w * px : q.w;
        if (q.d) { const d = q.px ? q.d * px : q.d; dashed(g, q.a[0], q.a[1], q.b[0], q.b[1], d, d * 0.8); g.stroke({ width: w, color: q.c, alpha: o }); }
        else g.moveTo(q.a[0], q.a[1]).lineTo(q.b[0], q.b[1]).stroke({ width: w, color: q.c, alpha: o, cap: 'round' });
      } else if (q.p === 'door') {
        const pl = doorPoly(q), sw = Math.max(q.w * 0.16, px);
        g.poly(pl, true).fill({ color: q.c, alpha: o * (q.dash ? 0.6 : 1) });
        if (q.dash) { for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; dashed(g, pl[i * 2], pl[i * 2 + 1], pl[j * 2], pl[j * 2 + 1], q.w * 0.7, q.w * 0.45); } g.stroke({ width: sw, color: q.s, alpha: o }); }
        else g.poly(pl, true).stroke({ width: sw, color: q.s, alpha: o, join: 'miter' });
        g.circle(q.a[0], q.a[1], q.w * 0.32).fill({ color: q.s, alpha: o });
      } else if (q.p === 'dot') {
        g.circle(q.x, q.y, q.r * px).fill({ color: q.c }).stroke({ width: 1.5 * px, color: 0x2b1d12 });
      } else if (q.p === 'lock') {
        const z = Math.max(0.16, 5 * px);
        g.rect(q.x - z, q.y - z * 0.2, z * 2, z * 1.5).fill(0xffd66e).stroke({ width: 1.5 * px, color: 0x2b1d12 });
        g.moveTo(q.x - z * 0.65, q.y - z * 0.2).arc(q.x, q.y - z * 0.2, z * 0.65, Math.PI, 0).stroke({ width: 1.5 * px, color: 0x2b1d12 });
      } else if (q.p === 'arrow') {
        const an = Math.atan2(q.b[1] - q.a[1], q.b[0] - q.a[0]), k = 7 * px;
        g.moveTo(q.a[0], q.a[1]).lineTo(q.b[0], q.b[1]).moveTo(q.b[0] - k * Math.cos(an - 0.5), q.b[1] - k * Math.sin(an - 0.5)).lineTo(q.b[0], q.b[1]).lineTo(q.b[0] - k * Math.cos(an + 0.5), q.b[1] - k * Math.sin(an + 0.5))
          .stroke({ width: 2.5 * px, color: q.c, alpha: o, cap: 'round', join: 'round' });
      }
    }
    return g;
  }
  function syncWalls(w, v) {
    if (!w) { if (wallKey) { wallInk.clear(); wallKey = ''; } wallTech.clear(); return; }
    if (w.key !== wallKey) { wallKey = w.key; wallInk.clear(); drawPrims(wallInk, w.ink || [], 1 / v.s); }
    wallTech.clear(); if (w.tech && w.tech.length) drawPrims(wallTech, w.tech, 1 / v.s);
  }

  /* ---------- Fichas ---------- */
  function dashedCircle(g, cx, cy, r, w, color) {
    const n = 14;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / n) * 0.55; g.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0)).arc(cx, cy, r, a0, a1); }
    g.stroke({ width: w, color });
  }
  function tokSig(t) { return [t.color, t.img || '', t.ini, t.s, t.hidden ? 1 : 0, t.sel ? 1 : 0, t.turn ? 1 : 0, t.pct == null ? '' : Math.round(t.pct * 40), t.down ? 1 : 0, t.ghost ? 1 : 0, t.bad ? 1 : 0, t.img && image(t.img) ? 1 : 0].join('|'); }
  function buildTok(t) {
    const box = new Container(), s = t.s || 1, rad = s * 0.44, g = new Graphics();
    if (t.turn) g.circle(0, 0, rad + Math.max(0.12, s * 0.08)).fill({ color: 0xffd66e, alpha: 0.55 });
    g.circle(0, 0, rad).fill(t.color || '#8c2626');
    box.addChild(g);
    const tex = t.img ? circleOf(t.img) : null;
    if (tex) { const sp = new Sprite(tex); sp.anchor.set(0.5); sp.width = sp.height = (rad - 0.04) * 2; box.addChild(sp); }
    else {
      const tx = new Text({ text: t.ini, resolution: 2, style: { fontFamily: 'Georgia, serif', fontWeight: '700', fontSize: TXT_BASE, fill: 0xffffff } });
      tx.anchor.set(0.5); tx.scale.set((rad * 0.8) / TXT_BASE); tx.position.set(0, 0.02); box.addChild(tx);
    }
    const ring = new Graphics(), lw = 0.06;
    if (t.hidden) dashedCircle(ring, 0, 0, rad, lw, t.sel ? 0xffd66e : 0x140c08);
    else if (t.bad) ring.circle(0, 0, rad).stroke({ width: lw * 1.8, color: 0xff4b3a });
    else ring.circle(0, 0, rad).stroke({ width: lw, color: t.sel ? 0xffd66e : 0x140c08, alpha: t.sel ? 1 : 0.85 });
    if (t.pct != null) {
      const p = Math.max(0, Math.min(1, t.pct));
      if (p > 0) ring.arc(0, 0, rad + lw * 1.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p).stroke({ width: 0.08, color: p > 0.66 ? 0x5fb85a : p > 0.33 ? 0xe0b43a : 0xd24a3a });
    }
    if (t.down) { const r6 = rad * 0.6; ring.moveTo(-r6, -r6).lineTo(r6, r6).moveTo(r6, -r6).lineTo(-r6, r6).stroke({ width: Math.max(0.06, rad * 0.18), color: 0xd24a3a }); }
    box.addChild(ring);
    box.alpha = t.ghost ? 0.85 : t.hidden ? 0.5 : 1;
    return box;
  }
  function label(i) {
    let l = labelPool[i];
    if (!l) { l = new Text({ text: '', resolution: 2, style: { fontFamily: 'Georgia, serif', fontWeight: '600', fontSize: LBL_BASE, fill: 0x2b1d12, stroke: { color: 0xf3e9d2, alpha: 0.9, width: 6, join: 'round' } } }); l.anchor.set(0.5, 0); labelPool[i] = l; }
    return l;
  }
  function syncTokens(list, v) {
    const alive = new Set();
    let li = 0;
    tokLow.removeChildren(); tokHigh.removeChildren();
    list.forEach((t) => {
      alive.add(t.id);
      const sig = tokSig(t); let o = tokObjs.get(t.id);
      if (!o || o.sig !== sig) { if (o) o.box.destroy({ children: true }); o = { box: buildTok(t), sig }; tokObjs.set(t.id, o); }
      const s = t.s || 1;
      o.box.position.set(t.x + s / 2, t.y + s / 2);
      (t.late ? tokHigh : tokLow).addChild(o.box);
      if (t.label) {
        const l = label(li++), fs = Math.max(10, Math.min(15, v.s * 0.38)), txt = t.name.length > 14 ? t.name.slice(0, 13) + '…' : t.name;
        if (l.text !== txt) l.text = txt;
        l.scale.set(fs / LBL_BASE / v.s); l.position.set(t.x + s / 2, t.y + s / 2 + s * 0.44 + 3 / v.s);
        (t.late ? tokHigh : tokLow).addChild(l);
      }
    });
    for (const [id, o] of tokObjs) if (!alive.has(id)) { o.box.destroy({ children: true }); tokObjs.delete(id); }
  }

  /* ---------- Encima: trazo en curso, borrador, regla, niebla en curso, señales ---------- */
  let ghostSig = '', ghostObj = null;
  const rulerBox = new Graphics(), rulerTxt = new Text({ text: '', resolution: 2, style: { fontFamily: 'Georgia, serif', fontWeight: '700', fontSize: 15, fill: 0xffd66e } });
  screen.addChild(rulerBox, rulerTxt);
  const pingTxt = [];
  function dashed(g, ax, ay, bx, by, on, off) {
    const L = Math.hypot(bx - ax, by - ay); if (!L) return g; const ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let d = 0; d < L; d += on + off) { const e = Math.min(L, d + on); g.moveTo(ax + ux * d, ay + uy * d).lineTo(ax + ux * e, ay + uy * e); }
    return g;
  }
  function syncTop(sc, v) {
    const W = sc.W, H = sc.H, px = 1 / v.s;
    preview.clear(); marks.clear(); rulerBox.clear(); rulerTxt.visible = false;
    if (sc.drawing) strokeShape(preview, sc.drawing);
    marks.alpha = 1; preview.alpha = 1;
    if (sc.erase && sc.erase.length) { const er = new Graphics(); sc.erase.forEach((k) => strokeShape(er, k, 0xff3b30)); er.alpha = 0.35; top.addChild(er); setTimeout(() => er.destroy(), 0); }
    // ficha que se arrastra
    if (sc.ghost) {
      const sig = tokSig(sc.ghost);
      if (sig !== ghostSig) { if (ghostObj) ghostObj.destroy({ children: true }); ghostObj = buildTok(sc.ghost); ghostSig = sig; ghostBox.addChild(ghostObj); }
      const s = sc.ghost.s || 1; ghostObj.position.set(sc.ghost.x + s / 2, sc.ghost.y + s / 2); ghostObj.visible = true;
    } else if (ghostObj) ghostObj.visible = false;
    if (sc.preview) for (const P of sc.preview.polys) if (P.length >= 6) marks.poly(P, true).fill({ color: 0xffd66e, alpha: 0.08 }).stroke({ width: 1.5 * px, color: 0xffd66e, alpha: 0.6 });
    const tag = (text, cx, cy, col) => {
      rulerTxt.text = text; rulerTxt.style.fill = col; rulerTxt.visible = true;
      const w = rulerTxt.width + 16, lx = Math.min(W - w - 4, Math.max(4, cx - w / 2)), ly = Math.max(4, cy - 13);
      rulerBox.rect(lx, ly, w, 26).fill({ color: 0x120d0b, alpha: 0.88 }).stroke({ width: 1, color: col });
      rulerTxt.position.set(lx + 8, ly + 13 - rulerTxt.height / 2);
    };
    if (sc.ruler) {
      const r = sc.ruler, col = r.bad ? 0xff6b5a : 0xffd66e, ax = v.x + r.ax * v.s, ay = v.y + r.ay * v.s, bx = v.x + r.bx * v.s, by = v.y + r.by * v.s;
      if (r.path && r.path.length > 1) { for (let i = 1; i < r.path.length; i++) dashed(rulerBox, v.x + r.path[i - 1][0] * v.s, v.y + r.path[i - 1][1] * v.s, v.x + r.path[i][0] * v.s, v.y + r.path[i][1] * v.s, 8, 6); }
      else dashed(rulerBox, ax, ay, bx, by, 8, 6);
      rulerBox.stroke({ width: 3, color: col, alpha: 0.95 });
      tag(r.text, bx, by - r.half * v.s - 21, col);
    } else if (sc.label) tag(sc.label.text, v.x + sc.label.x * v.s, v.y + sc.label.y * v.s - 26, 0xffd66e);
    if (sc.edit) {
      const ed = sc.edit;
      if (ed.lasso) { const l = ed.lasso; marks.rect(Math.min(l.x0, l.x1), Math.min(l.y0, l.y1), Math.abs(l.x1 - l.x0), Math.abs(l.y1 - l.y0)).fill({ color: 0xd9b866, alpha: 0.12 }).stroke({ width: 1.5 * px, color: 0xd9b866 }); }
      (ed.boxes || []).forEach((b) => marks.poly(polyOf(b), true).stroke({ width: px, color: 0xd9b866, alpha: 0.7 }));
      const H = ed.handles;
      if (H) {
        const c = H.corners, pl = []; c.forEach((q) => pl.push(q[0], q[1]));
        for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; dashed(marks, a[0], a[1], b[0], b[1], 7 * px, 4 * px); }
        marks.stroke({ width: 2 * px, color: 0xd9b866 });
        marks.moveTo(H.top[0], H.top[1]).lineTo(H.rot[0], H.rot[1]).stroke({ width: 2 * px, color: 0xd9b866 });
        c.forEach((q) => marks.rect(q[0] - 6 * px, q[1] - 6 * px, 12 * px, 12 * px).fill(0xfff8e6).stroke({ width: 2 * px, color: 0xd9b866 }));
        marks.circle(H.rot[0], H.rot[1], 8 * px).fill(0xd9b866).stroke({ width: 1.5 * px, color: 0x2b1d12 });
      }
    }
    if (sc.fogRect) {
      const f = sc.fogRect, x0 = Math.min(f.a[0], f.b[0]), y0 = Math.min(f.a[1], f.b[1]), w = Math.abs(f.a[0] - f.b[0]) + 1, h = Math.abs(f.a[1] - f.b[1]) + 1;
      marks.rect(x0, y0, w, h).fill(f.v ? { color: 0x5fb85a, alpha: 0.28 } : { color: 0x0a0604, alpha: 0.55 }).stroke({ width: 2 * px, color: f.v ? 0x5fb85a : 0xffd66e });
    }
    let pi = 0;
    (sc.pings || []).forEach((p) => {
      const col = p.color || '#ffd66e';
      for (let i = 0; i < 2; i++) marks.circle(p.x, p.y, (8 + ((p.k * 2 + i * 0.5) % 1) * v.s * 2.2) * px).stroke({ width: 4 * px, color: col, alpha: 1 - p.k });
      marks.circle(p.x, p.y, 5 * px).fill({ color: col, alpha: 1 - p.k });
      if (p.name) {
        let t = pingTxt[pi]; if (!t) { t = new Text({ text: '', resolution: 2, style: { fontFamily: 'Georgia, serif', fontWeight: '700', fontSize: 14, fill: 0xffffff, stroke: { color: 0x120d0b, width: 3 } } }); t.anchor.set(0.5, 1); pingTxt[pi] = t; screen.addChild(t); }
        t.text = p.name; t.alpha = 1 - p.k; t.visible = true; t.position.set(v.x + p.x * v.s, v.y + p.y * v.s - 10); pi++;
      }
    });
    for (let i = pi; i < pingTxt.length; i++) pingTxt[i].visible = false;
  }

  /* ---------- API ---------- */
  function render(sc) {
    if (dead) return;
    const v = sc.v, m = sc.map;
    world.position.set(v.x, v.y); world.scale.set(v.s);
    syncPaper(m); syncGrid(m, v); syncStrokes(m); syncWalls(sc.walls, v); syncTokens(sc.tokens || [], v); syncFog(sc.fog, m); syncTop(sc, v);
    app.render();
  }
  function resize(w, h, resolution) { if (dead) return; app.renderer.resize(w, h, resolution || app.renderer.resolution); }
  function destroy() {
    if (dead) return; dead = true;
    for (const e of imgCache.values()) { if (e.tex) e.tex.destroy(true); if (e.circle) e.circle.destroy(true); }
    imgCache.clear();
    try { if (fogRT) fogRT.destroy(true); if (fogRT2) fogRT2.destroy(true); fogComp.destroy({ children: true }); blurSp.destroy(); } catch (e) { /* nada */ }
    try { app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true }); } catch (e) { /* ya estaba muerto */ }
  }
  return { render, resize, destroy, kind: 'webgl', get dead() { return dead; } };
}

window.MapaGL = { create, version: 1 };
