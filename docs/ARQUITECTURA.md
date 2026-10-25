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
| `sala.js` | `Sala` | `Diario` | Cliente WebSocket de la sala de combate. |

## El personaje

Lo que se guarda (`localStorage['diario-v4']`) es mínimo: solo las elecciones. Todo lo demás se recalcula.

```js
C = {
  id, name, level, method, base: {str, dex, con, int, wis, cha},
  cl: ['Paladin|XPHB', …],   // clase tomada en cada nivel (multiclase); sin cl, todo es la clase principal
  house: { allSpells },       // reglas de la mesa
  ch: { cls, sub, race, bg, 'feat:asi4', 'gsp:…', 'opt:…', 'hp:5', … },  // elecciones por id
  rt: { hp, temp, slotsUsed, pactUsed, res, items, coins, conds, comp, notes, … }  // estado de juego
}
```

Las elecciones de una clase de multiclase llevan sufijo `@clase` (`sub@warlock`, `spells@warlock`, `asi4@fighter`). Al quitar el último nivel de esa clase se borran todas.

### `Rules5e.derive(C)` → `D`

- `D.classes`: una entrada por clase con su nivel, subclase y en qué niveles del personaje se tomó.
- `D.choices`: cada elección con `id`, `step` (paso del creador), `lv` (nivel del personaje en que aparece), `kind` (`one`, `many`, `spells`, `abil`, …), opciones y si está completa. El creador y el gating de nivel salen de aquí.
- `D.features`, `D.feats`, `D.extraSpells`, `D.casters` (uno por clase que lanza), `D.slots`, `D.pact`, `D.hp`, `D.ac`, `D.attacks`, `D.resources`…

## La sala de combate

```
 Teléfono A ──┐                   ┌── Teléfono B
   (sala.js)  │   WebSocket /ws   │   (sala.js)
              └──► server/index ◄─┘
                     │
                  rooms.mjs  (estado en memoria)
```

- El servidor guarda las salas en memoria; no hay base de datos. Una sala vive mientras alguien la use (hasta 8 horas; 30 minutos si se quedó vacía).
- **La hoja de cada jugador manda sobre sus propios PG.** Cuando alguien te aplica daño, el servidor lo refleja en tu resumen y te reenvía `applied`; tu diario lo aplica con las mismas reglas que la hoja (temporales primero, CD de concentración) y manda tu resumen nuevo con `char`.
- Los PNJ los guarda el servidor; los jugadores ven su estado ("herido", "malherido"), no sus números. El DM puede ocultarlos o esconder los PG del grupo.
- Reconexión: el servidor da un `token` al entrar; con él recuperas tu lugar si se cae la señal. El cliente reintenta solo.

El detalle de los mensajes está en [PROTOCOLO.md](PROTOCOLO.md).
