# Protocolo de la sala

WebSocket en `/ws`. Todos los mensajes son JSON con un campo `t`.

## Del cliente al servidor

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `create` | `name`, `char`, `dm` | cualquiera | Abre una sala nueva y entra. |
| `join` | `code`, `name`, `char`, `token?`, `dm?` | cualquiera | Entra a una sala. Con el `token` de antes recupera su lugar. Solo puede haber un DM. |
| `char` | `char` | jugador | Actualiza su resumen público (lo manda el diario cada vez que cambia la hoja). |
| `init` | `value`, `id?` | jugador (el suyo) / DM (cualquiera) | Pone la iniciativa; reordena. |
| `npc.add` | `name`, `ac`, `hp`, `init?`, `count?`, `hidden?` | DM | Agrega uno o varios PNJ ("Goblin 1", "Goblin 2"…). |
| `npc.del` | `id` | DM | Quita un PNJ. |
| `npc.set` | `id`, `hp?`, `hpMax?`, `delta?`, `ac?`, `name?`, `conds?` | DM | Ajusta a mano un enemigo: PG exactos, sumar o restar (`delta`), CA, nombre o la lista completa de estados. |
| `npc.reveal` | `id` | DM | Muestra u oculta un PNJ a los jugadores. |
| `hidepc` | `value` | DM | Oculta los PG exactos del grupo entre jugadores. |
| `turn` | `dir`: `start` \| `next` \| `prev` | DM / quien tiene el turno | Avanza el turno; al dar la vuelta sube la ronda. |
| `end` | — | DM | Termina el combate y borra la iniciativa. |
| `apply` | `targets[]`, `kind`, `amount?`, `cond?`, `note?` | jugadores; el DM solo sobre enemigos | `kind`: `damage`, `heal`, `temp`, `cond+`, `cond-`. El DM no modifica la hoja de los jugadores. |
| `leave` | — | cualquiera | Sale de la sala. |

### Enemigos, vida visible y encuentros

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `npc.add` | … `ref?`, `initMod?`, `formula?` | DM | `ref` = `Nombre|LIBRO` del bestiario (solo lo ve el DM, para abrir la ficha). |
| `npchp` | `value`: `none` \| `state` \| `bar` \| `pct` \| `num` | DM | Qué ven los jugadores de la vida de los enemigos. En la vista de un jugador cada PNJ trae `show` y, según eso, `state`, `pct` o `hp/hpMax/temp`. |
| `enc.load` | `enc: {name, npcs[], round, turnName, pcInit{nombre: init}}` | DM | Carga un encuentro guardado. La iniciativa de los jugadores se busca por el nombre del personaje (también para quien entre después). `create.restore.combat` usa el mismo formato. |

### Mapas

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `map.save` | `map: {id, name, cols, rows, grid, layers[{id,name}], strokes[]}` | cualquiera (reemplazar: DM o quien lo creó) | Crea o sube un mapa completo. Todos reciben `map`. |
| `map.get` | `id` | cualquiera | Pide el mapa completo (`map`). |
| `map.add` | `id`, `stroke: {k: pen\|line\|rect\|text, l: capa, c, w, pts[x,y…], t?, f?}` | cualquiera | Trazo en casillas del mapa. Todos reciben `map.add`. |
| `map.rm` / `map.undo` | `id`, `sids[]` | cualquiera | Borrar trazos / deshacer el último propio. Todos reciben `map.rm`. |
| `map.meta` | `id`, `name?`, `grid?`, `layers?` | cualquiera | Nombre, cuadrícula y capas (quitar una capa borra sus trazos). |
| `map.del` | `id` | DM o quien lo creó | Lo quita de la mesa (cada teléfono conserva su copia). |

El estado (`state`) trae `maps` con los datos de cada mapa sin los trazos (`n` = cuántos tiene, `updated`). Hasta 30 mapas por mesa, 6000 trazos por mapa, mapas de hasta 160 × 160 casillas.

### Mesa (chat, pizarra, tablero, sesión)

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `create` | … `restore?` | DM | Con `restore` (copia local: `code`, `title`, `started`, `chat`, `board`, `strokes`, `pages`) reabre la mesa con el mismo código si el servidor se reinició. |
| `chat.send` | `text`, `to?` | cualquiera | Mensaje. Con `to` es un susurro: solo entre un jugador y el DM. |
| `chat.roll` | `label`, `total`, `nat?`, `adv?`, `to?` | cualquiera | Tirada compartida (dados físicos): qué se tiró, el total y lo que salió en el d20. |
| `chat.img` | `img`, `caption?`, `to?` | cualquiera | Imagen ya subida por HTTP (`POST /api/img?code=&token=`, JPG/PNG/WebP/GIF ≤ 1,6 MB). Se ve en `GET /api/img/CODE/ID`. |
| `board.add` / `board.edit` | `item: {cat, title, text}`, `id?`, `img?` | DM | Nota del tablero. `cat`: `mision`, `pnj`, `lugar`, `pista`, `objeto`, `otro`. |
| `board.done` / `board.del` | `id` | DM | Marca como hecha o borra. |
| `draw.add` | `stroke: {color, w, pts, erase?}` | cualquiera | Trazo de la pizarra. `pts` es `[x, y, x, y…]` normalizado al ancho (y llega a 1,33). |
| `draw.undo` | — | cualquiera | Quita tu último trazo. |
| `draw.clear` | — | DM | Hoja nueva: la actual se archiva en `pages`. |
| `session.title` | `title` | DM | Título de la sesión. |
| `session.end` | — | DM | Termina la sesión: cada quien recibe `ended` con su resumen. |

Del servidor: `mesa.init` (al entrar: chat visible para ti y trazos actuales), `chat` (un mensaje nuevo, solo a quien puede verlo), `draw`, `draw.undo`, `draw.clear`, `ended` (`snapshot` con título, horas, chat visible, tablero, hojas de la pizarra y participantes). El estado (`state`) incluye además `board`, `session` y `pages`.

`char` (resumen del personaje):

```json
{ "name": "Lyra", "cls": "Paladin 9 / Warlock 2", "lvl": 11, "ac": 21, "hp": 78, "hpMax": 103, "temp": 0,
  "initMod": 0, "conc": "Bless", "conds": ["prone"], "comps": [{ "name": "Homunculus Servant", "ac": 13, "hp": 10, "hpMax": 10 }] }
```

Condiciones válidas: `blinded charmed deafened exhaustion frightened grappled incapacitated invisible paralyzed petrified poisoned prone restrained stunned unconscious concentration`.

## Del servidor al cliente

| `t` | Campos | Cuándo |
|---|---|---|
| `joined` | `code`, `you`, `token`, `role`, `rejoined` | Al crear o entrar. Guarda `token` para reconectar. |
| `state` | `room` | Después de cada cambio, a todos. Cada quien recibe su propia vista. |
| `applied` | `kind`, `amount`, `cond`, `note`, `from` | Alguien te aplicó algo: tu hoja lo aplica y responde con `char`. |
| `yourturn` | `round` | Empieza tu turno. |
| `error` | `code`, `msg` | `msg` ya viene en español para mostrarlo tal cual. |

`room` (vista):

```json
{ "code": "FASK", "you": "p…", "role": "player",
  "members": [{ "id": "p…", "role": "player", "name": "Lyra", "online": true, "init": 18, "char": { … } }],
  "npcs": [{ "id": "n…", "name": "Ogro 1", "init": 8, "conds": [], "state": "herido" }],
  "order": ["p…", "n…"], "turnId": "p…", "round": 1, "hidePc": false, "log": [{ "at": 0, "text": "…" }] }
```

Para el DM, cada PNJ trae además `ac`, `hp`, `hpMax`, `temp` y `hidden`.

## Límites

12 personas y 40 PNJ por sala, 500 salas por servidor, mensajes de hasta 2 MB, 80 mensajes cada 5 segundos por conexión.
