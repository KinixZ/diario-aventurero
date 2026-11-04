/* ==================== DADOS: 3D, SIN ANIMACIÓN O FÍSICOS ====================
   Cada quien elige en Ajustes (localStorage['diario-dados']):
     3d      los dados de tus tiradas ruedan en la pantalla (three.js, se baja solo la primera vez: dados3d.js)
     plano   sin animación: solo el resultado
     fisico  tiras tus dados de verdad y escribes lo que sacaste (el d20 y el total del daño)
   Los dados digitales los tira siempre el servidor; aquí solo se muestran. */
var Dados = (function(){
  var KEY = 'diario-dados', MODES = [['3d', 'En 3D', 'Tus tiradas ruedan en la pantalla'], ['plano', 'Sin animación', 'Solo el resultado'], ['fisico', 'Físicos', 'Tiras tus dados y escribes lo que sacaste']];
  var loading = null;
  function mode(){ try { var m = localStorage.getItem(KEY); return m === 'plano' || m === 'fisico' || m === '3d' ? m : '3d'; } catch(e){ return '3d'; } }
  function set(m){ try { localStorage.setItem(KEY, m); } catch(e){} paintBox(); }
  function artifact(){ return !!(window.DIARIO_CONFIG && DIARIO_CONFIG.artifact); }
  function canAnim(){ return !artifact() && !(window.Fx && Fx.mode && Fx.mode() === 'off') && (!window.Gfx || Gfx.engine() === 'webgl'); }
  function load(){
    if (window.Dados3D) return Promise.resolve(window.Dados3D);
    if (loading) return loading;
    loading = new Promise(function(res, rej){
      var s = document.createElement('script'), v = window.DIARIO_CONFIG && (DIARIO_CONFIG.dice || DIARIO_CONFIG.version);
      s.src = 'dados3d.js' + (v ? '?v=' + encodeURIComponent(v) : ''); s.async = true;
      s.onload = function(){ window.Dados3D ? res(window.Dados3D) : rej(new Error('sin dados')); };
      s.onerror = function(){ loading = null; rej(new Error('No pude bajar los dados.')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  /* Los dados de una tarjeta: el d20 (o los dos, con ventaja) y cada dado de daño con sus caras */
  function ofCard(k){
    var out = [];
    if (k.atk && k.atk.dice) k.atk.dice.forEach(function(v){ out.push({sides:20, value:v}); });
    if (k.death) out.push({sides:20, value:k.death.nat});
    (k.dmg || []).forEach(function(d){
      if (!d.rolls || !d.rolls.length) return; var parts = String(d.dice || '').replace(/\s+/g, '').match(/\d*d\d+/g) || [], i = 0;
      parts.forEach(function(p){ var m = /(\d*)d(\d+)/.exec(p), n = +(m[1] || 1), sides = +m[2]; for (var j = 0; j < n && i < d.rolls.length; j++) out.push({sides:sides, value:Math.abs(d.rolls[i++])}); });
    });
    return out.slice(0, 12);
  }
  function show(list, text){
    if (mode() !== '3d' || !list.length || !canAnim()) return;
    load().then(function(D){ return D.roll(list, {text:text}); }).catch(function(){});
  }
  /* Tu tarjeta llegó del servidor: ruedan sus dados con el resultado */
  function card(k){
    var t = []; if (k.atk) t.push(k.atk.total + ' para impactar' + (k.atk.crit ? ' · ¡crítico!' : '')); if (k.amt != null) t.push(k.amt + (k.heal ? ' PG' : ' de daño')); if (k.death) t.push('Salvación contra la muerte: ' + k.death.nat);
    show(ofCard(k), t.join(' · '));
  }
  function save(sv, label){ if (sv && sv.dice) show(sv.dice.map(function(v){ return {sides:20, value:v}; }), (label || 'Salvación') + ': ' + sv.total + (sv.ok ? ' · la supera' : ' · falla')); }
  /* Dados físicos: pregunta lo que sacaste (false si cancelas) */
  function ask(label){ var v = window.prompt(label + ' (1 a 20):', ''); if (v == null) return false; var n = parseInt(v, 10); return n >= 1 && n <= 20 ? n : false; }
  function paintBox(){
    var box = document.getElementById('diceBox'); if (!box) return; var m = mode();
    box.innerHTML = '<div class="seg" role="group" aria-label="Dados">' + MODES.map(function(x){ return '<button type="button" data-act="dicemode" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '" title="' + x[2] + '">' + x[1] + '</button>'; }).join('') + '</div>'
      + '<p class="note">' + (MODES.filter(function(x){ return x[0] === m; })[0] || MODES[0])[2] + '. ' + (m === 'fisico' ? 'En la escena de combate te pide el d20 y el total del daño; la iniciativa la escribes.' : 'Los tira el servidor y los ve todo el grupo.') + (m === '3d' && !canAnim() ? ' (En este aparato no se animan: falta WebGL o las animaciones están apagadas.)' : '') + '</p>'
      + (m === '3d' && canAnim() ? '<button class="btn sm" type="button" data-act="dicetry"><svg class="ic"><use href="#i-d20"/></svg>Probar</button>' : '');
  }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'dicemode') set(b.dataset.v);
    else if (b.dataset.act === 'dicetry') { var r = function(n){ return 1 + Math.floor(Math.random() * n); }; show([{sides:20, value:r(20)}, {sides:8, value:r(8)}, {sides:6, value:r(6)}, {sides:4, value:r(4)}, {sides:10, value:r(10)}, {sides:12, value:r(12)}], 'Así ruedan tus dados'); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBox); else setTimeout(paintBox, 0);
  return {mode:mode, set:set, card:card, save:save, show:show, ask:ask, ofCard:ofCard, load:load, paint:paintBox};
})();
