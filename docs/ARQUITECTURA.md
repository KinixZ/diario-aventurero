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
| `sala.js` | `Sala` | `Diario` | Cliente WebSocket de la sala (conexión, reconexión, combate). Expone `Sala.on/send` para otros módulos. |
| `mesa.js` | `Mesa` | `Sala` | Pestañas de la mesa: chat, tiradas, imágenes, susurros, pizarra, tablero y guardado de la sesión (Notas + archivo en IndexedDB). |
| `bestiario.js` | `Bestiario` | `Sala`, `Render5e` | Bestiario del DM (`bestiario-5e.json`, IndexedDB `bestiary`): buscador, ficha y agregar a la iniciativa. |
| `mapas.js` | `Mapas` | `Sala` | Mapas de las zonas: lienzo con zoom, cuadrícula, capas y trazos; copia en IndexedDB `map:<id>` e índice `localStorage['diario-mapas']`. |

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

## La sala de combate

```
 Teléfono A ──┐                   ┌── Teléfono B
   (sala.js)  │   WebSocket /ws   │   (sala.js)
              └──► server/index ◄─┘
                     │
                  rooms.mjs  (estado en memoria)
```

- El servidor guarda las salas en memoria; no hay base de datos. Una sala vive mientras alguien la use (hasta 10 horas; 30 minutos si se quedó vacía; 20 minutos después de terminar la sesión).
- **La hoja de cada jugador manda sobre sus propios PG.** Cuando alguien te aplica daño, el servidor lo refleja en tu resumen y te reenvía `applied`; tu diario lo aplica con las mismas reglas que la hoja (temporales primero, CD de concentración) y manda tu resumen nuevo con `char`.
- Los PNJ los guarda el servidor; los jugadores ven su estado ("herido", "malherido"), no sus números. El DM puede ocultarlos o esconder los PG del grupo.
- Reconexión: el servidor da un `token` al entrar; con él recuperas tu lugar si se cae la señal. El cliente reintenta solo.

El detalle de los mensajes está en [PROTOCOLO.md](PROTOCOLO.md).

## La mesa

La mesa es la misma sala del combate con más cosas: chat, pizarra y tablero. Para no mandar todo en cada cambio, el chat y la pizarra viajan como eventos sueltos (`chat`, `draw`) y el tablero va dentro del estado. Las imágenes se suben por HTTP y el chat solo lleva su id.

Cada teléfono guarda una copia de la mesa en `localStorage['diario-mesa']`. Si el servidor se reinicia (Render gratis se duerme), el DM la reabre automáticamente con esa copia y el mismo código; los jugadores reintentan solos durante dos minutos. Al terminar la sesión, cada quien recibe su resumen (sin los susurros ajenos), lo agrega a las Notas de su personaje y guarda un HTML con el chat, el tablero, las imágenes y las hojas de la pizarra en IndexedDB (`ses:<id>`), descargable desde la pestaña Notas.
