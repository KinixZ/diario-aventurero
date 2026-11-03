/* ==================== CLIMA SOBRE EL MAPA ====================
   Lluvia, tormenta, nieve, niebla y viento en un lienzo aparte encima del mapa: no toca el motor (WebGL o 2D),
   va a unos 30 cuadros por segundo y solo mientras el mapa se ve. Con las animaciones apagadas queda un cuadro quieto.
   Clima.set(lienzo, clave) lo prende o lo cambia; con 'despejado' se apaga. */
var Clima = (function(){
  var cv = null, ctx = null, kind = 'despejado', parts = [], blobs = [], raf = 0, last = 0, flash = 0, nextFlash = 0, W = 0, H = 0, dpr = 1;
  var KINDS = [['despejado','Despejado','i-sun'],['lluvia','Lluvia','i-rain'],['tormenta','Tormenta','i-storm'],['niebla','Niebla espesa','i-fog'],['nieve','Nieve','i-snow'],['viento','Viento','i-wind']];
  function motion(){ return window.Fx && Fx.mode ? Fx.mode() : 'sutil'; }
  function size(){
    var w = cv.clientWidth || 0, h = cv.clientHeight || 0; dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var changed = w !== W || h !== H; W = w; H = h; return changed;
  }
  function rnd(a, b){ return a + Math.random() * (b - a); }
  function seed(){
    parts = []; blobs = []; var area = Math.max(1, W * H), n;
    if (kind === 'lluvia' || kind === 'tormenta') { n = Math.min(kind === 'tormenta' ? 320 : 220, Math.round(area / (kind === 'tormenta' ? 1800 : 2600))); for (var i = 0; i < n; i++) parts.push({x:rnd(-40, W + 40), y:rnd(-H, H), v:rnd(700, 1050) * (kind === 'tormenta' ? 1.25 : 1), l:rnd(10, 20), a:rnd(0.25, 0.55)}); }
    else if (kind === 'nieve') { n = Math.min(200, Math.round(area / 4200)); for (var j = 0; j < n; j++) parts.push({x:rnd(0, W), y:rnd(0, H), r:rnd(1, 3.2), v:rnd(30, 80), ph:rnd(0, 6.28), a:rnd(0.5, 0.9)}); }
    else if (kind === 'viento') { n = Math.min(46, Math.round(area / 16000) + 8); for (var k = 0; k < n; k++) parts.push({x:rnd(-W, W), y:rnd(0, H), v:rnd(380, 620), l:rnd(40, 110), ph:rnd(0, 6.28), a:rnd(0.12, 0.3), leaf:Math.random() < 0.18}); }
    else if (kind === 'niebla') { for (var b = 0; b < 8; b++) blobs.push({x:rnd(0, W), y:rnd(0, H), r:rnd(0.25, 0.5) * Math.max(W, H), v:rnd(8, 22), a:rnd(0.1, 0.2)}); }
    nextFlash = 0;
  }
  function draw(dt, t){
    var c = ctx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    if (kind === 'lluvia' || kind === 'tormenta') {
      if (kind === 'tormenta') { c.fillStyle = 'rgba(10,14,30,.16)'; c.fillRect(0, 0, W, H); }
      c.strokeStyle = 'rgba(178,198,235,1)'; c.lineWidth = 1.2; c.lineCap = 'round';
      var slant = kind === 'tormenta' ? 0.32 : 0.18;
      parts.forEach(function(p){ p.y += p.v * dt; p.x += p.v * slant * dt; if (p.y > H + 20) { p.y = rnd(-60, -10); p.x = rnd(-60, W); } c.globalAlpha = p.a; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.l * slant, p.y - p.l); c.stroke(); });
      c.globalAlpha = 1;
      if (kind === 'tormenta' && motion() !== 'off') {
        if (!nextFlash) nextFlash = t + rnd(3000, 8000);
        if (t > nextFlash) { flash = 1; nextFlash = t + rnd(5000, 14000); }
        if (flash > 0) { c.fillStyle = 'rgba(235,240,255,' + (flash * (motion() === 'dramatica' ? 0.5 : 0.28)) + ')'; c.fillRect(0, 0, W, H); flash = Math.max(0, flash - dt * 3.2); }
      }
    } else if (kind === 'nieve') {
      c.fillStyle = '#fff';
      parts.forEach(function(p){ p.ph += dt * 1.4; p.y += p.v * dt; p.x += Math.sin(p.ph) * 18 * dt + 10 * dt; if (p.y > H + 5) { p.y = -5; p.x = rnd(0, W); } if (p.x > W + 5) p.x = -5; c.globalAlpha = p.a; c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill(); });
      c.globalAlpha = 1; c.fillStyle = 'rgba(220,230,245,.08)'; c.fillRect(0, 0, W, H);
    } else if (kind === 'niebla') {
      c.fillStyle = 'rgba(200,205,215,.14)'; c.fillRect(0, 0, W, H);
      blobs.forEach(function(b){ b.x += b.v * dt; if (b.x - b.r > W) b.x = -b.r; var g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); g.addColorStop(0, 'rgba(225,228,236,' + b.a + ')'); g.addColorStop(1, 'rgba(225,228,236,0)'); c.fillStyle = g; c.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2); });
    } else if (kind === 'viento') {
      c.lineCap = 'round';
      parts.forEach(function(p){
        p.x += p.v * dt; p.ph += dt * 3; if (p.x > W + p.l) { p.x = rnd(-W * 0.6, -p.l); p.y = rnd(0, H); }
        var y = p.y + Math.sin(p.ph) * 6;
        if (p.leaf) { c.globalAlpha = 0.75; c.fillStyle = '#8a6a2e'; c.save(); c.translate(p.x, y); c.rotate(p.ph); c.beginPath(); c.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
        else { c.globalAlpha = p.a; c.strokeStyle = '#e9eef5'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(p.x - p.l, y); c.quadraticCurveTo(p.x - p.l / 2, y - 5, p.x, y); c.stroke(); }
      });
      c.globalAlpha = 1;
    }
  }
  function alive(){ return cv && document.contains(cv) && cv.offsetParent !== null && !document.hidden; }
  function step(t){
    raf = 0; if (!alive() || kind === 'despejado') return;
    if (t - last >= 32) { var dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016; last = t; if (size()) seed(); draw(dt, t); }
    raf = requestAnimationFrame(step);
  }
  function stop(){ if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
  function set(canvas, k){
    k = k || 'despejado';
    if (canvas !== cv) { stop(); cv = canvas; ctx = cv ? cv.getContext && cv.getContext('2d') : null; W = H = 0; }
    var changed = k !== kind; kind = k;
    if (!cv || !ctx) return;
    if (kind === 'despejado') { stop(); size(); ctx.clearRect(0, 0, cv.width, cv.height); cv.hidden = true; return; }
    cv.hidden = false; size(); if (changed || !parts.length && !blobs.length) seed();
    if (motion() === 'off') { stop(); draw(0, 0); return; }
    if (!raf) raf = requestAnimationFrame(step);
  }
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && cv && kind !== 'despejado') set(cv, kind); });
  return {set:set, stop:stop, KINDS:KINDS, kind:function(){ return kind; }};
})();
