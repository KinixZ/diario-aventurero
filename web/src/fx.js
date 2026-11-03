/* ==================== ANIMACIONES ====================
   Tres niveles que el jugador elige en Ajustes:
     sutil      — rápidas y discretas (por defecto)
     dramática  — de videojuego: paso de página en 3D, sacudida al recibir daño, estandarte de turno, destellos
     apagadas   — nada se mueve (también si el sistema pide "reducir movimiento" y no se eligió otra cosa)
   El catálogo de abajo es la única lista: de ahí salen las clases del CSS y la tabla de Ajustes.
   <html data-motion="sutil|dramatica|off">. */
var Fx = (function(){
  var KEY = 'diario-fx';
  // [id, nombre, qué hace en sutil (o '' si no está), qué hace en dramática]
  var CATALOG = [
    ['tapa', 'Abrir y cerrar el diario', 'La tapa gira rápido', 'La tapa gira despacio y suelta chispas doradas'],
    ['pagina', 'Cambiar de separador', 'La página se desvanece y entra de lado', 'La página da la vuelta en 3D con su sombra'],
    ['entrada', 'Tarjetas al aparecer', '', 'Entran una tras otra, de abajo hacia arriba'],
    ['hojas', 'Paneles y ventanas', 'Aparecen con un desvanecido', 'Se despliegan desde el centro'],
    ['botones', 'Botones', 'Se hunden al tocarlos', 'Se hunden y sueltan un brillo'],
    ['numeros', 'Números que cambian', 'Saltan un poco (vida, espacios, monedas)', 'Saltan y brillan con el color del cambio'],
    ['dano', 'Recibir daño', 'La vida parpadea en rojo', 'La pantalla tiembla y se oscurece en rojo por los bordes'],
    ['curacion', 'Curarse', 'La vida parpadea en verde', 'Suben destellos verdes desde abajo'],
    ['turno', 'Aviso de tu turno', 'Una franja pequeña arriba', 'Estandarte inclinado a toda pantalla, estilo Persona'],
    ['critico', 'Golpe crítico', '', 'Destello dorado y la palabra CRÍTICO'],
    ['ambiente', 'Brillos de ambiente', 'El broche de la tapa late', 'Motas de polvo flotando y runas que brillan']
  ];
  var MODES = [['sutil','Sutiles','Rápidas y discretas'],['dramatica','Dramáticas','De videojuego: sacudidas, estandartes y destellos'],['off','Apagadas','Nada se mueve']];
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
  function read(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}').m || 'auto'; } catch(e){ return 'auto'; } }
  var chosen = read();
  function mode(){ return chosen === 'auto' ? (reduce.matches ? 'off' : 'sutil') : chosen; }
  function on(){ return mode() !== 'off'; }
  function drama(){ return mode() === 'dramatica'; }
  function apply(){ document.documentElement.setAttribute('data-motion', mode()); }
  function set(m){ chosen = m; try { localStorage.setItem(KEY, JSON.stringify({m:m})); } catch(e){} apply(); paintBox(); }

  /* ---------- Capa de efectos encima de todo ---------- */
  var layer = null;
  function fxLayer(){ if (layer && document.body.contains(layer)) return layer; layer = document.createElement('div'); layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); return layer; }
  function spawn(cls, html, ms){ var el = document.createElement('div'); el.className = cls; if (html) el.innerHTML = html; fxLayer().appendChild(el); setTimeout(function(){ el.remove(); }, ms || 1500); return el; }

  /* Un número que cambió: salta (y en dramática brilla del color del cambio) */
  function pop(el, dir){
    if (!el || !on()) return;
    el.classList.remove('fx-pop', 'fx-up', 'fx-down'); void el.offsetWidth;
    el.classList.add('fx-pop'); if (dir) el.classList.add(dir > 0 ? 'fx-up' : 'fx-down');
    setTimeout(function(){ el.classList.remove('fx-pop', 'fx-up', 'fx-down'); }, 700);
  }
  /* Tu vida cambió: daño o curación */
  function hp(prev, now, max){
    if (prev == null || now == null || prev === now || !on()) return;
    var dmg = now < prev, amt = Math.abs(now - prev), k = max ? amt / max : 0.2;
    document.querySelectorAll('.vt-hp .bar, .hp-top, .vt-hpn b').forEach(function(el){ el.classList.remove('fx-hurt', 'fx-heal'); void el.offsetWidth; el.classList.add(dmg ? 'fx-hurt' : 'fx-heal'); setTimeout(function(){ el.classList.remove('fx-hurt', 'fx-heal'); }, 900); });
    document.querySelectorAll('.vt-hpn b').forEach(function(el){ pop(el, dmg ? -1 : 1); });
    if (window.Sfx) Sfx.play(dmg ? 'hit' : 'heal', {k:k});
    if (!drama()) return;
    if (dmg) {
      var app = document.querySelector('.app'); if (app) { app.style.setProperty('--shake', Math.min(14, 4 + k * 30) + 'px'); app.classList.remove('fx-shake'); void app.offsetWidth; app.classList.add('fx-shake'); setTimeout(function(){ app.classList.remove('fx-shake'); }, 600); }
      spawn('fx-vignette hurt', '', 1100).style.setProperty('--k', Math.min(1, 0.35 + k * 1.5));
      if (now <= 0) spawn('fx-banner down', '<b>Caído</b><small>Tira salvaciones contra la muerte</small>', 2600);
    } else {
      var box = spawn('fx-rise heal', '', 1700), n = Math.min(18, 6 + Math.round(k * 30));
      for (var i = 0; i < n; i++) { var s = document.createElement('i'); s.style.left = (5 + Math.random() * 90) + '%'; s.style.animationDelay = (Math.random() * 0.5) + 's'; s.style.setProperty('--d', (60 + Math.random() * 40) + 'vh'); box.appendChild(s); }
    }
  }
  /* Estandarte a toda pantalla (turno, crítico, subir de nivel) */
  function announce(title, sub, kind){
    if (window.Sfx) Sfx.play(kind === 'crit' ? 'crit' : kind === 'level' ? 'level' : 'turn');
    if (!on()) return;
    if (!drama()) { spawn('fx-strip ' + (kind || ''), '<b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : ''), 2200); return; }
    spawn('fx-banner ' + (kind || 'turn'), '<span class="fx-slash"></span><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : ''), 2300);
  }
  function crit(){ if (!drama()) { if (window.Sfx) Sfx.play('crit'); return; } spawn('fx-flash', '', 700); announce('¡Crítico!', 'Dados de daño al doble', 'crit'); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  /* Chispas al abrir la tapa (dramática) */
  function sparks(x, y, n){
    if (!drama()) return; var box = spawn('fx-sparks', '', 1400); box.style.left = x + 'px'; box.style.top = y + 'px';
    for (var i = 0; i < (n || 22); i++) { var s = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 120; s.style.setProperty('--x', Math.cos(a) * d + 'px'); s.style.setProperty('--y', Math.sin(a) * d - 40 + 'px'); s.style.animationDelay = Math.random() * 0.15 + 's'; box.appendChild(s); }
  }
  /* Motas de polvo en la portada (dramática) */
  function motes(host){
    if (!host || host.querySelector('.fx-motes')) return; var box = document.createElement('div'); box.className = 'fx-motes'; box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 16; i++) { var s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 100 + '%'; s.style.animationDelay = -Math.random() * 12 + 's'; s.style.animationDuration = 9 + Math.random() * 8 + 's'; box.appendChild(s); }
    host.appendChild(box);
  }

  /* ---------- Ajustes ---------- */
  function paintBox(){
    var box = document.getElementById('fxBox'); if (!box) return; var m = mode();
    box.innerHTML = '<div class="seg fx-modes" role="group" aria-label="Animaciones">' + MODES.map(function(x){ return '<button type="button" data-act="fxmode" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '" title="' + x[2] + '">' + x[1] + '</button>'; }).join('') + '</div>'
      + (chosen === 'auto' && reduce.matches ? '<p class="note">Tu teléfono pide reducir el movimiento, por eso están apagadas. Puedes encenderlas aquí.</p>' : '')
      + '<table class="fx-table"><thead><tr><th>Animación</th><th>' + (m === 'off' ? 'Qué se quita' : m === 'sutil' ? 'Cómo se ve' : 'Cómo se ve') + '</th></tr></thead><tbody>'
      + CATALOG.map(function(c){
        var txt = m === 'off' ? (c[3] ? 'Quitada: ' + (c[2] || c[3]).charAt(0).toLowerCase() + (c[2] || c[3]).slice(1) : '') : m === 'sutil' ? (c[2] || '<span class="muted">Quitada (solo en dramáticas: ' + c[3].charAt(0).toLowerCase() + c[3].slice(1) + ')</span>') : c[3];
        return '<tr><td>' + c[1] + '</td><td>' + txt + '</td></tr>';
      }).join('') + '</tbody></table>'
      + '<div class="row fx-try"><button class="btn sm" type="button" data-act="fxtry" data-v="turno">Probar aviso de turno</button><button class="btn sm" type="button" data-act="fxtry" data-v="dano">Probar daño</button><button class="btn sm" type="button" data-act="fxtry" data-v="cura">Probar curación</button></div>';
  }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act="fxmode"],[data-act="fxtry"]'); if (!b) return;
    if (b.dataset.act === 'fxmode') set(b.dataset.v);
    else if (b.dataset.v === 'turno') announce('¡Tu turno!', 'Ronda 3');
    else if (b.dataset.v === 'dano') hp(40, 22, 60);
    else hp(22, 40, 60);
  });
  /* Botones: brillo al tocar (dramática) */
  document.addEventListener('pointerdown', function(ev){
    if (!drama()) return; var b = ev.target.closest && ev.target.closest('.btn.main, .btn.dmg, .btn.heal, .econ button'); if (!b) return;
    var r = b.getBoundingClientRect(), g = document.createElement('span'); g.className = 'fx-shine'; g.style.left = (ev.clientX - r.left) + 'px'; g.style.top = (ev.clientY - r.top) + 'px';
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative'; b.style.overflow = 'hidden'; b.appendChild(g); setTimeout(function(){ g.remove(); }, 600);
  }, {passive:true});
  if (reduce.addEventListener) reduce.addEventListener('change', function(){ apply(); paintBox(); });
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBox); else setTimeout(paintBox, 0);

  return {mode:mode, on:on, drama:drama, set:set, pop:pop, hp:hp, announce:announce, crit:crit, sparks:sparks, motes:motes, CATALOG:CATALOG, paint:paintBox};
})();
