# Arquitectura

## Idea general

El diario es una sola página sin framework. `tools/build-web.mjs` concatena estilos, iconos, marcado y scripts en `web/dist/index.html`, que funciona igual servido por el servidor del proyecto, por GitHub Pages o como artefacto de claude.ai.

Los scripts se cargan en este orden y cada uno expone un objeto global:

| Archivo | Global | Depende de | Qué hace |
|---|---|---|---|
| `lib.js` | `Lib5e` | — | Importa JSON de 5etools o el paquete, resuelve `_copy`, indexa y busca por tipo, nombre y libro (prefiere 2024). Del bestiario solo guarda compañeros. |
| `render.js` | `Render5e` | `Lib5e` | Convierte `entries` y etiquetas `{@spell …}` en HTML; los enlaces son `a.ref[data-ref="tipo\|nombre\|libro"]`. |
| `rules.js` | `Rules5e` | `Lib5e` | `derive(C)` toma un personaje guardado y devuelve todo lo calculado (`D`) más la lista de elecciones pendientes. Sin DOM: se puede probar en Node. |
| `app.js` | `Diario` | los anteriores | El libro: hoja, conjuros, mochila, rasgos, notas, grimorio, creador, compañeros, traducción, modo combate. |
| `sala.js` | `Sala` | `Diario` | Conexión WebSocket a las campañas: lista guardada (`localStorage['diario-campanas']`), cambiar de campaña, reconexión y la lista de iniciativa. Expone `Sala.on/send` para otros módulos. |
| `mesa.js` | `Mesa` | `Sala` | Pestañas de la mesa: chat, tiradas, imágenes, susurros, pizarra, tablero y guardado de la sesión (Notas + archivo en IndexedDB). |
| `campana.js` | `Campana` | `Sala`, `Mesa` | Pestaña Inicio: selector de campañas, entrar con código, crear o abrir como DM y el panel del DM (sesión, mapa en pantalla, bestiario, ajustes). Activa la vista ancha `.app.camp-wide`. |
| `bestiario.js` | `Bestiario` | `Sala`, `Render5e` | Bestiario del DM (`bestiario-5e.json`, IndexedDB `bestiary`): buscador, ficha y agregar a la iniciativa. |
| `grupo.js` | `Grupo` | `Sala`, `Bestiario` | Bestiario del grupo: lista, ficha compartida, notas y formulario del DM. |
| `mapas.js` | `Mapas` | `Sala` | Mesa virtual: lienzo con zoom, cuadrícula, capas, trazos, fondo, fichas, niebla, regla y señales; modos Jugar / Dibujar / Niebla. Copia en IndexedDB `map:<id>` e índice `localStorage['diario-mapas']`. |

## El personaje

Lo que se guarda (`localStorage['diario-v4']`) es mínimo: solo las elecciones. Todo lo demás se recalcula.

```js
C = {
  id, name, level, method, base: {str, dex, con, int, wis, cha},
  cl: ['Paladin|XPHB', …],   // clase tomada en cada nivel (multiclase); sin cl, todo es la clase principal
  house: { allSpells },       // reglas de la mesa
  hbAb: [ { id, name, cost, uses, rest, kind, ab, saveAb, dice, addMod, dtype, range, text } ],  // habilidades homebrew
  ch: { cls, sub, race, bg, 'feat:asi4', 'gsp:…', 'opt:…', 'hp:5', … },  // elecciones por id
  rt: { hp, temp, slotsUsed, pactUsed, res, items, coins, conds, comp, notes, quick, … }  // estado de juego; quick = acceso rápido ('sp:Nombre|Libro', 'f:Rasgo', 'hb:id', 'it:id')
}
```

Las elecciones de una clase de multiclase llevan sufijo `@clase` (`sub@warlock`, `spells@warlock`, `asi4@fighter`). Al quitar el último nivel de esa clase se borran todas.

### `Rules5e.derive(C)` → `D`

- `D.classes`: una entrada por clase con su nivel, subclase y en qué niveles del personaje se tomó.
- `D.choices`: cada elección con `id`, `step` (paso del creador), `lv` (nivel del personaje en que aparece), `kind` (`one`, `many`, `spells`, `abil`, …), opciones y si está completa. El creador y el gating de nivel salen de aquí.
- `D.hbAbilities`: habilidades homebrew con sus números ya calculados (usos, ataque, CD, daño); también entran a `D.features` (origen `Homebrew`) y a `D.resources` (`hb:id`, con `rest`).
- `Rules5e.costOf(texto)` y `spellCost(conjuro)` dicen si algo cuesta acción, adicional o reacción.
- `D.features`, `D.feats`, `D.extraSpells`, `D.casters` (uno por clase que lanza), `D.slots`, `D.pact`, `D.hp`, `D.ac`, `D.attacks`, `D.resources`…

## Las campañas

```
 Teléfono / tablet / laptop ──┐                 ┌── Teléfono B
   (sala.js, campana.js…)     │  WebSocket /ws  │
                              └► server/index ◄─┘
                                      │
                               campaigns.mjs  (en memoria mientras se usa)
                                      │
                                 store.mjs  ──► Postgres (Neon) · archivos · memoria
```

- Una campaña tiene un código fijo de 6 letras y una clave del DM (scrypt). Vive en la base de datos y se carga en memoria al entrar alguien; se guarda cada 4 segundos si cambió y se descarga tras 20 minutos sin uso.
- Los miembros se recuerdan con un `token`: puedes volver días después y recuperas tu lugar. El DM puede entrar desde varios aparatos con su clave.
- **En sesión / fuera de sesión** lo decide el DM. Todo funciona fuera de sesión; la sesión solo agrupa el chat y produce el resumen al terminar.
- **La hoja de cada jugador manda sobre sus propios PG.** Cuando alguien te aplica daño, el servidor te reenvía `applied`; tu diario lo aplica con las mismas reglas que la hoja y manda tu resumen nuevo con `char`.
- Los PNJ, mapas, fichas, niebla y bestiario los guarda el servidor. Cada quien recibe su propia vista: los jugadores no ven PNJ ocultos, capas del DM, fichas ocultas ni mapas en preparación.
- Las imágenes (fondos de mapa, retratos, chat) se suben por HTTP y se guardan en `campaign_images`; los mensajes solo llevan su id.

El detalle de los mensajes está en [PROTOCOLO.md](PROTOCOLO.md).

## La mesa

Chat, pizarra y tablero son parte de la campaña. El chat y la pizarra viajan como eventos sueltos (`chat`, `draw`) y el tablero va dentro del estado. Al terminar la sesión, cada quien recibe su resumen (sin los susurros ajenos), lo agrega a las Notas de su personaje y guarda un HTML con el chat, el tablero, las imágenes y las hojas de la pizarra en IndexedDB (`ses:<id>`), descargable desde la pestaña Notas.

## Los mapas

Un mapa es `{cols, rows, grid, layers, strokes, tokens, fog, bg}` en coordenadas de casilla. Las fichas se arrastran en modo Jugar (el servidor valida que sea tuya o que seas el DM); la regla mide con la distancia de D&D (diagonales cuentan 1, 1,5 m por casilla). La niebla es un bit por casilla. Cada aparato guarda una copia en IndexedDB para abrir rápido y revisar los mapas sin conexión.
