/* ==================== SONIDO ====================
   Todo se sintetiza en el navegador (Web Audio): no hay archivos, no pesa nada, no necesita licencias y suena sin internet.
   Cuatro canales con su volumen (Ajustes → Sonido): interfaz, combate, ambiente y música.
   El DM pone un ambiente y una música para toda la mesa (mensaje amb.set); cada quien decide su volumen.
   Los navegadores solo dejan sonar después del primer toque: hasta entonces, lo pendiente espera. */
var Sfx = (function(){
  var KEY = 'diario-sfx';
  var DEF = {on:true, master:0.8, ui:0.55, combate:0.8, ambiente:0.6, musica:0.45};
  var cfg = (function(){ try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch(e){ return Object.assign({}, DEF); } })();
  var ctx = null, master = null, bus = {}, verb = null, verbIn = null, noiseBuf = null, unlocked = false;
  var wantAmb = null, curAmbKey = '', layers = {amb:null, mus:null, url:null};
  var CH = [['ui','Interfaz','Páginas, botones, la tapa'],['combate','Combate','Golpes, curaciones, turnos, críticos, dados'],['ambiente','Ambiente','Lluvia, viento, fuego… lo que ponga el DM'],['musica','Música','La que ponga el DM']];
  var AMB = [['lluvia','Lluvia'],['tormenta','Tormenta'],['viento','Viento'],['fuego','Hoguera'],['mazmorra','Mazmorra'],['bosque','Bosque'],['mar','Mar'],['taberna','Taberna']];
  var MUS = [['calma','Exploración'],['combate','Combate'],['taberna','Taberna'],['misterio','Misterio']];

  function save(){ try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch(e){} }
  function ensure(){
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch(e){ return null; }
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    master = ctx.createGain(); master.connect(comp);
    CH.forEach(function(c){ bus[c[0]] = ctx.createGain(); bus[c[0]].connect(master); });
    // reverberación generada: un poco de sala para campanas, goteos y gongs
    verb = ctx.createConvolver(); verb.buffer = impulse(2.6, 2.2); verbIn = ctx.createGain(); verbIn.gain.value = 1; verbIn.connect(verb); verb.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    levels(); return ctx;
  }
  function impulse(sec, decay){ var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var ch = 0; ch < 2; ch++) { var d = b.getChannelData(ch); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  function levels(){ urlVol(); if (!ctx) return; var t = ctx.currentTime; master.gain.setTargetAtTime(cfg.on ? cfg.master : 0, t, 0.05); CH.forEach(function(c){ bus[c[0]].gain.setTargetAtTime(cfg[c[0]], t, 0.05); }); }
  function ready(){ var c = ensure(); if (!c) return null; if (c.state === 'suspended') { c.resume(); if (!unlocked) return null; } return c; }
  ['pointerdown', 'keydown', 'touchend'].forEach(function(ev){ document.addEventListener(ev, function(){ var c = ensure(); if (!c) return; if (c.state === 'suspended') c.resume().then(function(){ unlocked = true; if (wantAmb) applyAmb(wantAmb); }); else { unlocked = true; if (wantAmb && !curAmbKey) applyAmb(wantAmb); } }, {passive:true, capture:true}); });

  /* ---------- Piezas ---------- */
  function g(v){ var n = ctx.createGain(); n.gain.value = v == null ? 1 : v; return n; }
  function env(param, t, a, peak, d, end){ param.cancelScheduledValues(t); param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); param.exponentialRampToValueAtTime(Math.max(0.0001, end || 0.0001), t + a + d); }
  function noise(t, dur, loop){ var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = !!loop; s.start(t, Math.random() * 1.5, loop ? undefined : dur + 0.05); return s; }
  function filt(type, f, q){ var n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q != null) n.Q.value = q; return n; }
  function osc(type, f, t, dur){ var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; }
  function chain(){ for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }
  function tone(dest, type, f, t, a, d, peak, f2){ var o = osc(type, f, t, a + d), e = g(0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d); env(e.gain, t, a, peak, d); chain(o, e, dest); return e; }
  function burst(dest, t, dur, type, f, q, peak, f2){ var s = noise(t, dur), fl = filt(type, f, q), e = g(0); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); env(e.gain, t, 0.004, peak, dur); chain(s, fl, e, dest); return e; }
  /* Campana FM: portadora + moduladora inarmónica */
  function bell(dest, f, t, dur, peak, ratio, index, wet){
    var c = osc('sine', f, t, dur), m = osc('sine', f * (ratio || 3.5), t, dur), mg = g(f * (index || 3)), e = g(0);
    mg.gain.setValueAtTime(f * (index || 3), t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
    chain(m, mg); mg.connect(c.frequency); env(e.gain, t, 0.005, peak, dur); chain(c, e, dest); if (wet) { var w = g(wet); e.connect(w); w.connect(verbIn); }
  }
  /* Cuerda pulsada (Karplus-Strong): laúd, arpa */
  function pluck(dest, f, t, peak, bright){
    var s = noise(t, 0.02), ex = g(0), dl = ctx.createDelay(0.05), fb = g(0.985 - (f > 600 ? 0.01 : 0)), lp = filt('lowpass', bright || 3200, 0.3), out = g(peak);
    ex.gain.setValueAtTime(1, t); ex.gain.setValueAtTime(0, t + 1 / f * 1.2);
    dl.delayTime.value = 1 / f; chain(s, ex, dl, lp, fb, dl); lp.connect(out); out.gain.setValueAtTime(peak, t); out.gain.exponentialRampToValueAtTime(0.0001, t + 2.6); out.connect(dest);
    setTimeout(function(){ try { fb.disconnect(); out.disconnect(); } catch(e){} }, (t - ctx.currentTime + 2.8) * 1000);
  }
  function mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------- Efectos ---------- */
  var FX = {
    click: function(t){ burst(bus.ui, t, 0.025, 'highpass', 2200, 0.7, 0.18); tone(bus.ui, 'sine', 1700, t, 0.002, 0.03, 0.05); },
    toggle: function(t){ tone(bus.ui, 'triangle', 1200, t, 0.002, 0.04, 0.08); tone(bus.ui, 'triangle', 1650, t + 0.05, 0.002, 0.05, 0.08); },
    page: function(t){ burst(bus.ui, t, 0.2, 'bandpass', 700, 0.9, 0.35, 3400); burst(bus.ui, t + 0.09, 0.12, 'bandpass', 1800, 1.1, 0.15, 4200); },
    open: function(t){ tone(bus.ui, 'sine', 95, t, 0.01, 0.35, 0.7, 42); burst(bus.ui, t, 0.3, 'lowpass', 500, 0.7, 0.35); var o = osc('sawtooth', 190, t + 0.05, 0.5), f = filt('bandpass', 900, 9), e = g(0); o.frequency.exponentialRampToValueAtTime(130, t + 0.5); env(e.gain, t + 0.05, 0.08, 0.05, 0.4); chain(o, f, e, bus.ui); FX.page(t + 0.35); },
    close: function(t){ tone(bus.ui, 'sine', 80, t, 0.005, 0.32, 0.9, 34); burst(bus.ui, t, 0.18, 'lowpass', 420, 0.8, 0.6); },
    coin: function(t){ bell(bus.ui, 2350, t, 0.35, 0.1, 2.01, 0.6); bell(bus.ui, 3150, t + 0.07, 0.4, 0.08, 2.01, 0.6); },
    level: function(t){ [60, 64, 67, 72].forEach(function(n, i){ var tt = t + i * 0.11, o = osc('sawtooth', mtof(n), tt, 1), f = filt('lowpass', 500, 1), e = g(0); f.frequency.exponentialRampToValueAtTime(2600, tt + 0.15); f.frequency.exponentialRampToValueAtTime(900, tt + 0.9); env(e.gain, tt, 0.03, 0.09, 0.9); chain(o, f, e, bus.ui); var w = g(0.25); e.connect(w); w.connect(verbIn); }); },
    hit: function(t, o){ var k = Math.min(1, 0.45 + (o && o.k || 0.2) * 1.4); burst(bus.combate, t, 0.14, 'lowpass', 1600, 0.6, 0.7 * k); tone(bus.combate, 'sine', 130, t, 0.004, 0.28, 0.9 * k, 38); tone(bus.combate, 'square', 70, t, 0.002, 0.08, 0.12 * k, 40); },
    heal: function(t){ [84, 88, 91, 96].forEach(function(n, i){ bell(bus.combate, mtof(n), t + i * 0.075, 0.9, 0.07, 2, 0.5, 0.5); }); },
    crit: function(t){ bell(bus.combate, 520, t, 1.6, 0.22, 3.5, 4, 0.6); burst(bus.combate, t, 0.5, 'bandpass', 4200, 6, 0.15); tone(bus.combate, 'sine', 110, t, 0.004, 0.4, 0.8, 40); },
    turn: function(t){ bell(bus.combate, 98, t, 3.2, 0.32, 1.41, 3.2, 0.7); bell(bus.combate, 196, t, 2.4, 0.08, 1.41, 2, 0.5); },
    spell: function(t){ burst(bus.combate, t, 0.7, 'highpass', 500, 0.7, 0.18, 6000); var o = osc('sine', 600, t, 0.7), e = g(0); o.frequency.exponentialRampToValueAtTime(1800, t + 0.6); env(e.gain, t, 0.05, 0.08, 0.6); chain(o, e, bus.combate); var w = g(0.6); e.connect(w); w.connect(verbIn); },
    dice: function(t){ var tt = t; for (var i = 0; i < 7; i++) { burst(bus.combate, tt, 0.018, 'bandpass', 2400 + Math.random() * 2200, 3, 0.3 * (1 - i / 9)); tt += 0.03 + Math.random() * 0.07 * (1 + i / 4); } }
  };
  var lastAt = {};
  function play(name, o){
    if (!cfg.on || !FX[name]) return; var c = ready(); if (!c) return;
    var now = c.currentTime; if (lastAt[name] && now - lastAt[name] < 0.05) return; lastAt[name] = now; // evita amontonar el mismo sonido
    try { FX[name](now + 0.01, o || {}); } catch(e){}
  }

  /* ---------- Ambientes (bucles generados) ---------- */
  var AMBS = {
    lluvia: function(out){ var s = noise(ctx.currentTime, 0, true), hp = filt('highpass', 380), lp = filt('lowpass', 5200), v = g(0.32); chain(s, hp, lp, v, out); return every(function(t){ tone(out, 'sine', 2400 + Math.random() * 2400, t, 0.001, 0.02, 0.04 * Math.random(), 900); }, 40, 160, [s]); },
    tormenta: function(out){ var a = AMBS.lluvia(out), b = every(function(t){ var s = noise(t, 3.5), lp = filt('lowpass', 160 + Math.random() * 120, 0.6), e = g(0); env(e.gain, t, 0.08 + Math.random() * 0.3, 0.9, 3.2); chain(s, lp, e, out); tone(out, 'sine', 42, t, 0.2, 3, 0.35); }, 7000, 18000); return {stop:function(){ a.stop(); b.stop(); }}; },
    viento: function(out, soft){ var s = noise(ctx.currentTime, 0, true), bp = filt('bandpass', 500, 0.9), v = g(soft ? 0.15 : 0.32), l1 = osc('sine', 0.07, ctx.currentTime, 1e6), l1g = g(320), l2 = osc('sine', 0.045, ctx.currentTime, 1e6), l2g = g(soft ? 0.08 : 0.16);
      chain(l1, l1g); l1g.connect(bp.frequency); chain(l2, l2g); l2g.connect(v.gain); chain(s, bp, v, out); return holder([s, l1, l2]); },
    fuego: function(out){ var s = noise(ctx.currentTime, 0, true), lp = filt('lowpass', 420, 0.5), v = g(0.3); chain(s, lp, v, out); return every(function(t){ burst(out, t, 0.006 + Math.random() * 0.01, 'highpass', 2500 + Math.random() * 3000, 1, 0.08 + Math.random() * 0.25); }, 25, 220, [s]); },
    mazmorra: function(out){ var t0 = ctx.currentTime, lp = filt('lowpass', 260, 0.5), v = g(0.09), a = osc('sine', 55, t0, 1e6), b = osc('sine', 55.6, t0, 1e6), c = osc('triangle', 82.4, t0, 1e6), cg = g(0.4); chain(c, cg, lp); a.connect(lp); b.connect(lp); chain(lp, v, out);
      return every(function(t){ var e = tone(out, 'sine', 1300 + Math.random() * 700, t, 0.002, 0.09, 0.09, 520); var w = g(0.9); e.connect(w); w.connect(verbIn); }, 1300, 5000, [a, b, c]); },
    bosque: function(out){ var w = AMBS.viento(out, true), b = every(function(t){ var n = 2 + Math.floor(Math.random() * 4), base = 2600 + Math.random() * 2600; for (var i = 0; i < n; i++) { var tt = t + i * (0.09 + Math.random() * 0.05), o = osc('sine', base, tt, 0.12), e = g(0), m = osc('sine', 30 + Math.random() * 40, tt, 0.12), mg = g(base * 0.15); o.frequency.exponentialRampToValueAtTime(base * (0.7 + Math.random() * 0.6), tt + 0.1); chain(m, mg); mg.connect(o.frequency); env(e.gain, tt, 0.01, 0.035, 0.1); chain(o, e, out); } }, 1800, 6000); return {stop:function(){ w.stop(); b.stop(); }}; },
    mar: function(out){ var t0 = ctx.currentTime, s = noise(t0, 0, true), lp = filt('lowpass', 800, 0.4), v = g(0.22), l = osc('sine', 0.085, t0, 1e6), lg = g(0.2), s2 = noise(t0, 0, true), hp = filt('bandpass', 2400, 0.5), v2 = g(0.04), l2 = osc('sine', 0.085, t0 + 1, 1e6), l2g = g(0.04);
      chain(l, lg); lg.connect(v.gain); chain(l2, l2g); l2g.connect(v2.gain); chain(s, lp, v, out); chain(s2, hp, v2, out); return holder([s, s2, l, l2]); },
    taberna: function(out){ var t0 = ctx.currentTime, voices = [], i;
      for (i = 0; i < 4; i++) { var s = noise(t0, 0, true), bp = filt('bandpass', 260 + i * 210, 2.2), v = g(0.06), l = osc('sine', 3 + Math.random() * 3, t0, 1e6), lg = g(0.05); chain(l, lg); lg.connect(v.gain); chain(s, bp, v, out); voices.push(s, l); }
      return every(function(t){ if (Math.random() < 0.5) bell(out, 2600 + Math.random() * 900, t, 0.25, 0.03, 2.4, 0.8, 0.3); else burst(out, t, 0.05, 'bandpass', 900, 1.5, 0.06); }, 900, 3200, voices); }
  };
  function holder(nodes){ return {stop:function(){ nodes.forEach(function(n){ try { n.stop(); } catch(e){} }); }}; }
  function every(fn, min, max, nodes){ var alive = true, tm = null; (function loop(){ if (!alive) return; try { fn(ctx.currentTime + 0.05); } catch(e){} tm = setTimeout(loop, min + Math.random() * (max - min)); })(); return {stop:function(){ alive = false; clearTimeout(tm); (nodes || []).forEach(function(n){ try { n.stop(); } catch(e){} }); }}; }

  /* ---------- Música generativa ---------- */
  var MUSIC = {
    calma: {bpm:60, beat:function(out, t, i){ var ch = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]][Math.floor(i / 4) % 4];
      if (i % 4 === 0) ch.forEach(function(n){ for (var d = -1; d <= 1; d += 2) { var o = osc('sawtooth', mtof(n - 12) * (1 + d * 0.003), t, 4.2), lp = filt('lowpass', 700, 0.5), e = g(0); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.022, t + 1.4); e.gain.setValueAtTime(0.022, t + 2.8); e.gain.exponentialRampToValueAtTime(0.0001, t + 4.2); chain(o, lp, e, out); } });
      if (Math.random() < 0.7) pluck(out, mtof([69, 72, 74, 76, 79, 81][Math.floor(Math.random() * 6)]), t + Math.random() * 0.4, 0.12, 2400); }},
    combate: {bpm:104, steps:4, beat:function(out, t, i){ var s = i % 16;
      if ([0, 3, 8, 10].indexOf(s) >= 0) tone(out, 'sine', 150, t, 0.002, 0.3, 0.7, 42);
      if (s === 4 || s === 12) burst(out, t, 0.16, 'bandpass', 1700, 0.8, 0.28);
      if (s % 2 === 1) burst(out, t, 0.03, 'highpass', 6000, 0.7, 0.05);
      if ([6, 7, 14].indexOf(s) >= 0) { tone(out, 'sine', 210, t, 0.002, 0.22, 0.35, 105); burst(out, t, 0.08, 'lowpass', 900, 0.7, 0.12); }
      if (s % 2 === 0) { var bass = [38, 38, 41, 38, 36, 38, 33, 36][(s / 2) % 8], o = osc('sawtooth', mtof(bass), t, 0.25), lp = filt('lowpass', 520, 3), e = g(0); env(e.gain, t, 0.005, 0.12, 0.22); chain(o, lp, e, out); }
      if (s === 0 && Math.floor(i / 16) % 2 === 1) [50, 53, 57].forEach(function(n){ var o = osc('sawtooth', mtof(n), t, 0.9), lp = filt('lowpass', 400, 1), e = g(0); lp.frequency.exponentialRampToValueAtTime(2200, t + 0.1); lp.frequency.exponentialRampToValueAtTime(600, t + 0.8); env(e.gain, t, 0.02, 0.05, 0.85); chain(o, lp, e, out); }); }},
    taberna: {bpm:132, steps:3, beat:function(out, t, i){ var s = i % 6, sc = [62, 64, 65, 67, 69, 71, 72, 74, 76];
      if (s === 0 || s === 3) { pluck(out, mtof(s === 0 ? 38 : 45), t, 0.22, 1400); }
      if (!this.p || i % 12 === 0) this.p = Math.floor(Math.random() * 5);
      this.p = Math.max(0, Math.min(sc.length - 1, this.p + [-1, 0, 1, 1, -2, 2][Math.floor(Math.random() * 6)]));
      if (Math.random() < 0.85) pluck(out, mtof(sc[this.p]), t, 0.14, 3600);
      if (s === 0 && Math.random() < 0.3) pluck(out, mtof(sc[this.p] - 12), t, 0.08, 2000); }},
    misterio: {bpm:40, beat:function(out, t, i){
      if (i % 8 === 0) [38, 45].forEach(function(n){ var o = osc('sine', mtof(n), t, 8.5), o2 = osc('sine', mtof(n) * 1.004, t, 8.5), e = g(0); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.05, t + 3); e.gain.setValueAtTime(0.05, t + 5.5); e.gain.exponentialRampToValueAtTime(0.0001, t + 8.5); o.connect(e); o2.connect(e); e.connect(out); });
      if (Math.random() < 0.55) bell(out, mtof([74, 76, 78, 80, 82, 84][Math.floor(Math.random() * 6)]), t + Math.random() * 0.8, 2.2, 0.04, 2.76, 1.2, 0.8);
      if (i % 2 === 0) tone(out, 'sine', 55, t, 0.05, 0.6, 0.08); }}
  };
  function startMusic(key, out){
    var m = MUSIC[key]; if (!m) return null; var step = 60 / m.bpm / (m.steps || 1), next = ctx.currentTime + 0.1, i = 0, alive = true, state = {};
    var tm = setInterval(function(){ if (!alive) return; while (next < ctx.currentTime + 0.35) { try { m.beat.call(state, out, next, i); } catch(e){} next += step; i++; } }, 90);
    return {stop:function(){ alive = false; clearInterval(tm); }};
  }

  /* ---------- Lo que suena en la mesa ---------- */

  function fadeOut(L){ if (!L) return; var t = ctx.currentTime; L.gain.gain.cancelScheduledValues(t); L.gain.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(function(){ try { L.src && L.src.stop(); L.gain.disconnect(); } catch(e){} }, 2600); }
  function fadeIn(gn, v){ var t = ctx.currentTime; gn.gain.setValueAtTime(0.0001, t); gn.gain.setTargetAtTime(v, t, 0.7); }
  function applyAmb(a){
    a = a || {}; var key = [a.k || '', a.m || '', a.url || '', a.v == null ? 1 : a.v].join('|'); wantAmb = a;
    if (!unlocked || !ensure()) return; if (key === curAmbKey) return; curAmbKey = key;
    var vol = a.v == null ? 1 : Math.max(0, Math.min(1, +a.v));
    [['amb', a.k, 'ambiente'], ['mus', a.m, 'musica']].forEach(function(x){
      var L = layers[x[0]]; if (L && L.key === x[1]) { L.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.4); return; }
      fadeOut(L); layers[x[0]] = null; if (!x[1]) return;
      var gn = g(0); gn.connect(bus[x[2]]); var src = x[0] === 'amb' ? (AMBS[x[1]] ? AMBS[x[1]](gn) : null) : startMusic(x[1], gn);
      if (!src) return; fadeIn(gn, vol); layers[x[0]] = {key:x[1], gain:gn, src:src};
    });
    // Pista propia (un enlace a un mp3/ogg): un <audio> normal. No pasa por Web Audio porque otro sitio
    // sin permisos CORS sonaría en silencio; su volumen se ajusta a mano.
    var U = layers.url; if (U && U.key !== a.url) { U.el.pause(); U.el.removeAttribute('src'); layers.url = null; U = null; }
    if (a.url && !U) { var el = new Audio(); el.loop = true; el.preload = 'auto'; el.src = a.url; el.play().catch(function(){}); layers.url = U = {key:a.url, el:el, v:vol}; }
    if (U) { U.v = vol; urlVol(); }
  }
  function urlVol(){ var U = layers.url; if (U && U.el) U.el.volume = Math.max(0, Math.min(1, (cfg.on ? cfg.master * cfg.musica : 0) * U.v)); }
  function nowPlaying(a){ a = a || wantAmb || {}; var n = []; if (a.k) n.push((AMB.filter(function(x){ return x[0] === a.k; })[0] || [0, a.k])[1]); if (a.m) n.push((MUS.filter(function(x){ return x[0] === a.m; })[0] || [0, a.m])[1]); if (a.url) n.push('pista propia'); return n.join(' · '); }

  /* ---------- Ajustes ---------- */
  function paintBox(){
    var box = document.getElementById('sfxBox'); if (!box) return;
    box.innerHTML = '<label class="toggle big"><input type="checkbox" id="sfxOn"' + (cfg.on ? ' checked' : '') + '> Sonido</label>'
      + '<div class="sfx-vols"' + (cfg.on ? '' : ' hidden') + '>' + [['master', 'General', '']].concat(CH).map(function(c){ return '<label class="sfx-vol"><span><b>' + c[1] + '</b>' + (c[2] ? '<small>' + c[2] + '</small>' : '') + '</span><input type="range" min="0" max="100" step="5" data-sfxvol="' + c[0] + '" value="' + Math.round(cfg[c[0]] * 100) + '" aria-label="Volumen: ' + c[1] + '"><output>' + Math.round(cfg[c[0]] * 100) + '</output></label>'; }).join('')
      + '<div class="row sfx-try"><button class="btn sm" type="button" data-act="sfxtry" data-v="page">Página</button><button class="btn sm" type="button" data-act="sfxtry" data-v="hit">Golpe</button><button class="btn sm" type="button" data-act="sfxtry" data-v="heal">Curación</button><button class="btn sm" type="button" data-act="sfxtry" data-v="turn">Turno</button><button class="btn sm" type="button" data-act="sfxtry" data-v="dice">Dados</button></div></div>'
      + '<p class="note">Todo se genera en tu teléfono: no gasta datos. El ambiente y la música los pone el DM; aquí decides qué tan fuerte los oyes.</p>';
  }
  document.addEventListener('input', function(ev){ var k = ev.target && ev.target.dataset && ev.target.dataset.sfxvol; if (!k) return; cfg[k] = (+ev.target.value) / 100; var o = ev.target.nextElementSibling; if (o) o.textContent = ev.target.value; levels(); save(); });
  document.addEventListener('change', function(ev){ if (ev.target && ev.target.id === 'sfxOn') { cfg.on = ev.target.checked; levels(); save(); paintBox(); if (cfg.on) play('toggle'); } });
  document.addEventListener('click', function(ev){ var b = ev.target.closest && ev.target.closest('[data-act="sfxtry"]'); if (b) play(b.dataset.v); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBox); else setTimeout(paintBox, 0);

  return {play:play, ambience:applyAmb, nowPlaying:nowPlaying, AMB:AMB, MUS:MUS, paint:paintBox, cfg:function(){ return Object.assign({}, cfg); }};
})();
