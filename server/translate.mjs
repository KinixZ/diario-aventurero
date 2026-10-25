// Traducción en el servidor, para teléfonos sin traductor integrado (Chrome Android, Safari).
// Proveedor según las variables de entorno:
//   ANTHROPIC_API_KEY  → Claude (mejor con términos de D&D: salvación, ventaja, pies → metros)
//   DEEPL_API_KEY      → DeepL (hay plan gratis; no convierte medidas)
//   TR_PROVIDER=mock   → solo para pruebas
// Cada texto se traduce una vez y queda en una caché compartida por todo el grupo.

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const PROMPT = `Traduce al español de México el texto en inglés de este fragmento HTML con reglas de Dungeons & Dragons.
Reglas:
1) Conserva exactamente todas las etiquetas HTML y sus atributos. No traduzcas ni cambies los valores de class ni de data-ref.
2) Usa la terminología oficial de D&D en español: saving throw = tirada de salvación; ability check = prueba de característica; attack roll = tirada de ataque; Advantage = ventaja; Disadvantage = desventaja; Action = acción; Bonus Action = acción adicional; Reaction = reacción; spell slot = espacio de conjuro; cantrip = truco; Hit Points = puntos de golpe; Temporary Hit Points = puntos de golpe temporales; Armor Class = clase de armadura; Proficiency Bonus = bonificador de competencia; Concentration = concentración; Difficulty Class (DC) = clase de dificultad (CD); Short Rest = descanso corto; Long Rest = descanso largo; Strength = Fuerza; Dexterity = Destreza; Constitution = Constitución; Intelligence = Inteligencia; Wisdom = Sabiduría; Charisma = Carisma; Blinded = cegado; Charmed = hechizado; Deafened = ensordecido; Frightened = asustado; Grappled = agarrado; Incapacitated = incapacitado; Paralyzed = paralizado; Petrified = petrificado; Poisoned = envenenado; Prone = derribado; Restrained = apresado; Stunned = aturdido; Unconscious = inconsciente.
3) Convierte distancias en pies a metros (5 pies = 1,5 m).
4) Traduce los nombres de conjuros, dotes y objetos y deja el nombre original en inglés entre paréntesis la primera vez que aparezcan, por ejemplo: Bola de fuego (Fireball).
5) Responde solo con el HTML traducido, sin explicaciones y sin bloques de código.`;

const MAX_CHARS = 24000;

export function createTranslator(env = process.env) {
  const provider = env.TR_PROVIDER || (env.ANTHROPIC_API_KEY ? 'claude' : env.DEEPL_API_KEY ? 'deepl' : '');
  const daily = Number(env.TR_DAILY_CHARS) || 400000;      // tope de caracteres nuevos al día (lo cacheado no cuenta)
  const file = env.TR_CACHE_FILE || '';
  const cache = new Map(), pending = new Map();
  let used = 0, day = today(), saveT = null, loaded = false;

  async function load() {
    if (loaded || !file) { loaded = true; return; }
    loaded = true;
    try { const j = JSON.parse(await readFile(file, 'utf8')); for (const [k, v] of Object.entries(j)) cache.set(k, v); } catch {}
  }
  function persist() {
    if (!file) return;
    clearTimeout(saveT);
    saveT = setTimeout(async () => { try { await mkdir(dirname(file), { recursive: true }); await writeFile(file, JSON.stringify(Object.fromEntries(cache))); } catch {} }, 2000);
  }

  async function callProvider(html) {
    if (provider === 'mock') return '<span class="mock">ES</span>' + html;
    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: env.TR_MODEL || 'claude-haiku-5-5', max_tokens: 8000, system: PROMPT, messages: [{ role: 'user', content: html }] }),
      });
      if (!res.ok) throw fail(res.status === 429 ? 'rate_limited' : 'provider', `Claude respondió ${res.status}`);
      const j = await res.json();
      return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '');
    }
    if (provider === 'deepl') {
      const host = /:fx$/.test(env.DEEPL_API_KEY) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
      const res = await fetch(host + '/v2/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'DeepL-Auth-Key ' + env.DEEPL_API_KEY },
        body: JSON.stringify({ text: [html], source_lang: 'EN', target_lang: 'ES', tag_handling: 'html', formality: 'prefer_less' }),
      });
      if (!res.ok) throw fail(res.status === 429 || res.status === 456 ? 'rate_limited' : 'provider', `DeepL respondió ${res.status}`);
      const j = await res.json();
      return j.translations && j.translations[0] ? j.translations[0].text : '';
    }
    throw fail('no_engine', 'El servidor no tiene traductor configurado.');
  }

  async function translate(html) {
    await load();
    html = String(html || '');
    if (!html.trim()) throw fail('bad_request', 'No hay texto.');
    if (html.length > MAX_CHARS) throw fail('too_large', 'El texto es demasiado largo para traducirlo de una vez.');
    const key = createHash('sha256').update(provider + '|' + html).digest('base64url');
    if (cache.has(key)) return { html: cache.get(key), cached: true };
    if (pending.has(key)) return { html: await pending.get(key), cached: true }; // dos personas abren el mismo conjuro a la vez
    if (day !== today()) { day = today(); used = 0; }
    if (used + html.length > daily) throw fail('rate_limited', 'Se llegó al límite de traducciones de hoy.');
    used += html.length;
    const p = callProvider(html).finally(() => pending.delete(key));
    pending.set(key, p);
    const out = await p;
    if (!out) throw fail('provider', 'El traductor no devolvió nada.');
    cache.set(key, out); persist();
    return { html: out, cached: false };
  }

  return { provider, translate, status: () => ({ enabled: !!provider, provider, cached: cache.size }) };
}

function today() { return new Date().toISOString().slice(0, 10); }
function fail(code, message) { const e = new Error(message); e.code = code; return e; }
