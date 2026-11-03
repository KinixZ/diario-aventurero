/* ==================== GRÁFICOS: CALIDAD Y MOTOR ====================
   Una sola fuente para "qué tanto puede este aparato": la usan el mapa (WebGL o Canvas),
   y después las animaciones, las luces y las partículas.
   Ajuste guardado en localStorage['diario-gfx'] = {q:'auto'|'baja'|'media'|'alta', engine:'auto'|'2d'}.
   <html data-gfx="baja|media|alta"> para que el CSS también pueda recortar efectos. */
var Gfx = (function(){
  var KEY = 'diario-gfx', listeners = [], glState = null, glLoad = null, glError = '';
  var LEVELS = [['auto','Automática','Según tu aparato'],['baja','Baja','Para teléfonos lentos: sin suavizado, menos resolución, sin partículas'],['media','Media','Suavizado y resolución media'],['alta','Alta','Resolución completa, sombras suaves y todos los efectos']];
  function read(){ try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); return {q:o.q || 'auto', engine:o.engine || 'auto'}; } catch(e){ return {q:'auto', engine:'auto'}; } }
  var cfg = read();
  function write(){ try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch(e){} }

  /* Nivel automático: memoria y núcleos del aparato (sin datos, "media") */
  function guess(){
    var mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0, dpr = window.devicePixelRatio || 1;
    if ((mem && mem <= 2) || (cores && cores <= 2)) return 'baja';
    if ((mem && mem >= 8) && cores >= 8) return 'alta';
    if (!mem && cores >= 8 && dpr <= 2) return 'alta';
    return 'media';
  }
  function level(){ return cfg.q === 'auto' ? guess() : cfg.q; }
  function resolution(){ var dpr = window.devicePixelRatio || 1, l = level(); return l === 'baja' ? Math.min(dpr, 1) : l === 'media' ? Math.min(dpr, 1.5) : Math.min(dpr, 2.5); }
  function antialias(){ return level() !== 'baja'; }

  /* ¿Hay WebGL? Se prueba una vez en un lienzo aparte */
  function glSupported(){
    if (glState !== null) return glState;
    glState = false;
    try {
      if (!window.WebGLRenderingContext) return glState;
      var cv = document.createElement('canvas'), ctx = cv.getContext('webgl2') || cv.getContext('webgl');
      glState = !!ctx;
      var lose = ctx && ctx.getExtension && ctx.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } catch(e){ glState = false; }
    return glState;
  }
  function artifact(){ return !!(window.DIARIO_CONFIG && DIARIO_CONFIG.artifact); }
  function wantGL(){ return cfg.engine !== '2d' && !glError && !artifact() && glSupported(); }
  function engine(){ return wantGL() ? 'webgl' : '2d'; }

  /* El motor del mapa vive en otro archivo (mapa-gl.js): se baja la primera vez que se abre un mapa */
  function loadGL(){
    if (window.MapaGL) return Promise.resolve(window.MapaGL);
    if (glLoad) return glLoad;
    glLoad = new Promise(function(res, rej){
      var s = document.createElement('script'), v = window.DIARIO_CONFIG && (DIARIO_CONFIG.gl || DIARIO_CONFIG.version);
      s.src = 'mapa-gl.js' + (v ? '?v=' + encodeURIComponent(v) : ''); s.async = true;
      s.onload = function(){ window.MapaGL ? res(window.MapaGL) : rej(new Error('El motor del mapa no se cargó.')); };
      s.onerror = function(){ glLoad = null; rej(new Error('No pude bajar el motor del mapa.')); };
      document.head.appendChild(s);
    });
    return glLoad;
  }
  /* Se adelanta la descarga (por ejemplo al entrar a una campaña) para que el mapa abra al instante */
  function preload(){ if (wantGL()) loadGL().catch(function(){}); }
  function failed(e){ glError = (e && e.message) || 'WebGL no disponible'; paintBox(); }

  function apply(){ document.documentElement.setAttribute('data-gfx', level()); }
  function set(k, v){ cfg[k] = v; write(); apply(); paintBox(); listeners.forEach(function(f){ try { f(info()); } catch(e){} }); }
  function on(f){ listeners.push(f); }
  function info(){ return {level:level(), chosen:cfg.q, engine:engine(), resolution:resolution(), antialias:antialias(), error:glError}; }

  /* ---------- Ajustes ---------- */
  function paintBox(){
    var box = document.getElementById('gfxBox'); if (!box) return;
    var l = level(), gl = glSupported();
    box.innerHTML = '<div class="seg gfx-q" role="group" aria-label="Calidad gráfica">' + LEVELS.map(function(x){ return '<button type="button" data-act="gfxq" data-v="' + x[0] + '" aria-pressed="' + (cfg.q === x[0]) + '" title="' + x[2] + '">' + x[1] + '</button>'; }).join('') + '</div>'
      + '<p class="note gfx-now">' + (cfg.q === 'auto' ? 'Este aparato quedó en <b>' + l + '</b>. ' : '') + (LEVELS.filter(function(x){ return x[0] === l; })[0] || LEVELS[2])[2] + '.</p>'
      + '<label class="toggle"><input type="checkbox" id="gfx2d"' + (cfg.engine === '2d' ? ' checked' : '') + (gl ? '' : ' disabled') + '> Mapa en modo compatible (sin WebGL)</label>'
      + '<p class="note">' + (!gl ? 'Este navegador no tiene WebGL: el mapa usa el modo compatible.' : glError ? 'WebGL falló (' + glError.replace(/</g, '&lt;') + '): el mapa usa el modo compatible hasta que recargues.' : 'Motor del mapa: ' + (engine() === 'webgl' ? 'WebGL' : 'compatible') + '. Usa el compatible solo si el mapa se ve mal en tu teléfono.') + '</p>';
  }
  document.addEventListener('click', function(ev){ var b = ev.target.closest && ev.target.closest('[data-act="gfxq"]'); if (b) set('q', b.dataset.v); });
  document.addEventListener('change', function(ev){ if (ev.target && ev.target.id === 'gfx2d') set('engine', ev.target.checked ? '2d' : 'auto'); });
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBox); else setTimeout(paintBox, 0);

  return {level:level, resolution:resolution, antialias:antialias, wantGL:wantGL, engine:engine, loadGL:loadGL, preload:preload, failed:failed, on:on, info:info, paint:paintBox};
})();
