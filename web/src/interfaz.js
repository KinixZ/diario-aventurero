/* ==================== AJUSTES POR CATEGORÍAS ====================
   Ajustes abre en una portada: tu personaje y una lista de categorías, cada una con lo que tiene puesto ahora.
   Al tocar una, se ven solo sus secciones (las de siempre, con sus mismos controles) y «atrás» vuelve a la portada.
   Lo técnico (servidor, imágenes de monstruos, créditos) queda aparte en Avanzado. */
var Interfaz = (function(){
  var esc = function(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var CATS = [
    ['personajes', 'Personajes y respaldo', 'i-helm'],
    ['apariencia', 'Apariencia', 'i-brush'],
    ['anim', 'Animación y sonido', 'i-music'],
    ['combate', 'Combate y dados', 'i-d20'],
    ['mapa', 'Mapa y gráficos', 'i-map'],
    ['idioma', 'Idioma y traducción', 'i-chat'],
    ['biblioteca', 'Biblioteca de 5etools', 'i-book']
  ];
  var ADV = ['avanzado', 'Avanzado', 'i-gear'];
  var cat = null;
  function sheet(){ return document.getElementById('settingsSheet'); }
  function tryS(f, d){ try { var v = f(); return v == null || v === '' ? d : v; } catch(e){ return d; } }
  function ls(k){ try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch(e){ return {}; } }

  /* Lo que tiene puesto cada categoría, en una línea */
  function summary(k){
    if (k === 'personajes') return tryS(function(){ var C = Diario.cur(); return C ? (C.name || 'Sin nombre') + ' · cambiar, exportar e importar' : ''; }, 'Crear, cambiar, exportar e importar');
    if (k === 'apariencia') return tryS(function(){ var sk = document.documentElement.getAttribute('data-skin') || 'carmesi', b = document.querySelector('#skins [data-v="' + sk + '"] b, #skins [aria-pressed="true"] b'); var id = window.Identidad && Identidad.on ? Identidad.on() : !(ls('diario-id').off); return (b ? b.textContent : sk.charAt(0).toUpperCase() + sk.slice(1)) + ' · identidad de clase ' + (id ? 'encendida' : 'apagada'); }, 'Estilo del diario e identidad de clase');
    if (k === 'anim') return tryS(function(){ var m = Fx.mode(), c = Sfx.cfg(); return (m === 'off' ? 'Apagadas' : m === 'dramatica' ? 'Dramáticas' : 'Sutiles') + ' · ' + (c.on ? 'sonido al ' + Math.round((c.master || 0) * 100) + ' %' : 'sin sonido'); }, 'Animaciones y volumen');
    if (k === 'combate') return tryS(function(){ var m = Dados.mode(); return (m === 'fisico' ? 'Dados físicos' : m === 'plano' || m === 'sin' ? 'Dados sin animación' : 'Dados en 3D') + (document.getElementById('hudBg3') && document.getElementById('hudBg3').checked ? ' · iconos de acción' : ''); }, 'Cómo ves tus tiradas');
    if (k === 'mapa') return tryS(function(){ var q = Gfx.info(), L = {baja:'baja', media:'media', alta:'alta'}; return 'Calidad ' + (L[q.level] || q.level) + (q.chosen === 'auto' || !q.chosen ? ' (automática)' : ''); }, 'Calidad gráfica del mapa');
    if (k === 'idioma') return tryS(function(){ var b = document.querySelector('#trModes [aria-pressed="true"]'); return b ? 'Traducción: ' + b.textContent.trim().toLowerCase() : ''; }, 'Traducción al español');
    if (k === 'biblioteca') return tryS(function(){ var L = Lib5e.get && Lib5e.get(); if (!L || !L.spell || !L.spell.length) return 'Sin cargar: aquí cargas tu 5etools'; return 'Cargada · ' + L.spell.length + ' conjuros, ' + (L.subclass || []).length + ' subclases'; }, 'Tus datos de 5etools');
    return 'Servidor, imágenes de monstruos, créditos';
  }
  function catBtn(c, adv){ return '<button type="button" class="set-cat' + (adv ? ' adv' : '') + '" data-act="setcat" data-v="' + c[0] + '"><svg class="ic" aria-hidden="true"><use href="#' + c[2] + '"/></svg><span><b>' + esc(c[1]) + '</b><small>' + esc(summary(c[0])) + '</small></span><svg class="ic chev" aria-hidden="true"><use href="#i-chev"/></svg></button>'; }
  function whoHtml(){
    var C = tryS(function(){ return Diario.cur(); }, null), D = tryS(function(){ return Diario.D(); }, null);
    if (!C) return '';
    return '<div class="set-who"><span class="av">' + esc(String(C.name || '?').charAt(0).toUpperCase()) + '</span><span><b>' + esc(C.name || 'Sin nombre') + '</b><small>' + esc(D && D.ok ? D.clsLabel + ' · nivel ' + C.level : 'nivel ' + (C.level || 1)) + '</small></span><button class="btn sm" type="button" data-act="setcat" data-v="personajes">Cambiar</button></div>';
  }
  /* La portada: tu personaje y las categorías */
  function home(){
    var sh = sheet(); if (!sh) return; cat = null;
    var sc = sh.querySelector('.scroll'); if (!sc) return;
    var box = sh.querySelector('#setHome');
    if (!box) { sc.insertAdjacentHTML('afterbegin', '<div id="setHome"></div>'); box = sh.querySelector('#setHome'); }
    box.hidden = false;
    box.innerHTML = whoHtml() + '<nav class="set-home" aria-label="Categorías de ajustes">' + CATS.map(function(c){ return catBtn(c); }).join('') + '</nav><nav class="set-home" aria-label="Avanzado">' + catBtn(ADV, true) + '</nav>';
    box.style.display = 'flex'; box.style.flexDirection = 'column'; box.style.gap = '16px';
    sh.querySelectorAll('section[data-cat]').forEach(function(s){ s.hidden = true; });
    title('Ajustes', false); sc.scrollTop = 0;
  }
  /* Una categoría: solo sus secciones, con «atrás» */
  function show(k){
    var sh = sheet(); if (!sh) return; cat = k;
    var box = sh.querySelector('#setHome'); if (box) { box.hidden = true; box.style.display = 'none'; }
    sh.querySelectorAll('section[data-cat]').forEach(function(s){ s.hidden = s.getAttribute('data-cat') !== k; });
    var c = CATS.concat([ADV]).filter(function(x){ return x[0] === k; })[0];
    title(c ? c[1] : 'Ajustes', true); var sc = sh.querySelector('.scroll'); if (sc) sc.scrollTop = 0;
  }
  function title(t, back){
    var sh = sheet(), h = sh && sh.querySelector('#setTitle'); if (!h) return; h.textContent = t;
    var b = sh.querySelector('.set-back');
    if (back && !b) h.insertAdjacentHTML('beforebegin', '<button class="icon-btn set-back" type="button" data-act="sethome" aria-label="Volver a Ajustes"><svg class="ic"><use href="#i-back"/></svg></button>');
    else if (!back && b) b.remove();
  }
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'setcat') { ev.preventDefault(); show(b.dataset.v); }
    else if (b.dataset.act === 'sethome') { ev.preventDefault(); home(); }
  });
  return {home:home, show:show, cat:function(){ return cat; }, summary:summary, CATS:CATS};
})();
