# Protocolo de las campañas

WebSocket en `/ws`. Todos los mensajes son JSON con un campo `t`. Una conexión está en una campaña a la vez; el cliente cambia de campaña con `leave` + `join`.

## Entrar

| `t` | Campos | Qué hace |
|---|---|---|
| `camp.create` | `name`, `dmKey` | Crea una campaña con un código fijo de 6 letras y entra como DM. La clave se guarda con scrypt. |
| `join` | `code`, `token?`, `dmKey?`, `name?`, `char?` | Con `token` recupera su lugar (también tras días). Con `dmKey` entra como el DM (desde cualquier aparato). Sin nada entra como jugador nuevo; si ya existe un jugador desconectado con el mismo personaje, toma su lugar. Máximo 16 miembros. |
| `leave` | `forget?` | Sale de la campaña. Con `forget` el servidor olvida al jugador. |
| `ping` | — | Mantiene viva la conexión (`pong`). |

`joined` responde `{code, name, you, token, role, rejoined, created, durable}`. `durable: false` avisa que el servidor no tiene base de datos (todo vive en memoria).

HTTP:

- `GET /api/camp?codes=ABCDEF,GHJKMN` → resumen de cada campaña guardada (nombre, si está en sesión, gente conectada) o `missing`.
- `POST /api/img?code=&token=` (JPG/PNG/WebP/GIF ≤ 2 MB, 60 MB por campaña) → `{id}`. Se ve en `GET /api/img/CODE/ID`.
- `GET /health` → `{ok, campaigns, store, durable, storeError}`.

## Campaña y sesión

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `camp.name` | `name` | DM | Renombra la campaña. |
| `camp.key` | `key` | DM | Cambia la clave del DM. |
| `member.del` | `id` | DM | Quita a un jugador (recibe `kicked`). |
| `session.start` | `title?` | DM | Empieza la sesión N+1. Todos reciben `live`. |
| `session.title` | `title` | DM | Título de la sesión en curso. |
| `session.end` | — | DM | Termina la sesión: cada quien recibe `ended` con su resumen. |
| `char` | `char` | jugador | Actualiza su resumen público (lo manda el diario cada vez que cambia la hoja). |

Fuera de sesión todo sigue disponible: combate, chat, pizarra, tablero, mapas y bestiario. Los mensajes del chat llevan `ses` (número de sesión, o 0 fuera de sesión); el resumen de `ended` usa solo los de esa sesión.

## Combate

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `init` | `value`, `id?` | jugador (el suyo) / DM (cualquiera) | Pone la iniciativa; reordena. |
| `npc.add` | `name`, `ac`, `hp`, `init?`, `count?`, `hidden?`, `ref?`, `initMod?`, `formula?` | DM | Agrega uno o varios PNJ ("Goblin 1", "Goblin 2"…). `ref` = `Nombre|LIBRO` del bestiario (solo lo ve el DM). |
| `npc.del` | `id` | DM | Quita un PNJ. |
| `npc.set` | `id`, `hp?`, `hpMax?`, `delta?`, `ac?`, `name?`, `conds?` | DM | Ajusta a mano un enemigo. |
| `npc.reveal` | `id` | DM | Muestra u oculta un PNJ a los jugadores. |
| `hidepc` | `value` | DM | Oculta los PG exactos del grupo entre jugadores. |
| `npchp` | `value`: `none` \| `state` \| `bar` \| `pct` \| `num` | DM | Qué ven los jugadores de la vida de los enemigos. |
| `enc.load` | `enc: {name, npcs[], round, turnName, pcInit{nombre: init}}` | DM | Carga un encuentro guardado. |
| `turn` | `dir`: `start` \| `next` \| `prev` | DM / quien tiene el turno | Avanza el turno; al dar la vuelta sube la ronda. |
| `end` | — | DM | Termina el combate y borra la iniciativa. |
| `apply` | `targets[]`, `kind`, `amount?`, `cond?`, `note?` | jugadores; el DM solo sobre enemigos | `kind`: `damage`, `heal`, `temp`, `cond+`, `cond-`. |

Cuando un PNJ visible entra al combate (o el DM lo revela) y el registro automático está activo, se anota solo en el bestiario del grupo, sin el número del nombre ("Goblin 2" → "Goblin").

## Mapas (tablero de juego)

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `map.save` | `map: {id, name, cols, rows, grid, layers, strokes, hidden?}` | cualquiera (el DM los suyos ocultos) | Crea o reemplaza un mapa. `grid`: `square`, `hex` o `none`. |
| `map.meta` | `id`, `name?`, `grid?`, `layers?` | dueño / DM | Cambia nombre, cuadrícula o capas. Una capa con `dm: true` solo la ve el DM. |
| `map.hide` | `id`, `value` | DM | Oculta el mapa mientras lo prepara. |
| `map.del` | `id` | dueño / DM | Borra el mapa. |
| `map.get` | `id` | cualquiera que lo vea | Pide el mapa completo (`map`). |
| `map.add` | `id`, `stroke` | quien lo ve | Agrega un trazo (`pen`, `line`, `rect`, `text`). |
| `map.rm` / `map.undo` | `id`, `sids?` | quien lo ve | Borra trazos o deshace el último propio. |
| `map.bg` | `id`, `img?`, `op?` | dueño / DM | Imagen de fondo (subida por HTTP) y su opacidad. |
| `fog.on` | `id`, `value` | DM | Activa la niebla de guerra. |
| `fog.rect` | `id`, `rect: [x1, y1, x2, y2]`, `value` | DM | Descubre (`false`) o cubre (`true`) casillas. |
| `fog.all` | `id`, `value` | DM | Cubre o descubre todo. |
| `tok.add` | `id`, `tok: {x, y, s, name, color, img?, kind, ref?, hidden?, comp?}` | cualquiera | Pone una ficha. `kind`: `pc`, `npc`, `obj`. La ficha propia de un jugador es única por mapa: ponerla otra vez la mueve. Hasta 5 fichas por jugador y 120 por mapa. |
| `tok.move` | `id`, `tid`, `x`, `y` | dueño / DM | Mueve una ficha. |
| `tok.set` | `id`, `tid`, `name?`, `s?`, `color?`, `img?`, `hidden?`, `ref?` | dueño / DM (`hidden`, `ref` solo DM) | Ajusta una ficha. |
| `tok.del` | `id`, `tid` | dueño / DM | Quita una ficha. |
| `scene.set` | `id?` | DM | Muestra ese mapa a todos (lo destapa si estaba oculto). Sin `id` lo quita. |
| `map.ping` | `id`, `x`, `y`, `color?` | quien lo ve | Señala un punto (pulsación larga). |

La niebla viaja como base64 de un bit por casilla (`fog.cells`). Los jugadores no reciben capas del DM, fichas ocultas ni mapas ocultos.

## Bestiario del grupo

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `beast.add` / `beast.edit` | `beast: {id?, name, kind, ref?, img?, text?, info{type, cr, ac, hp, size, speed, where}, stat?, hidden?}` | DM | Registra o edita una criatura. `kind`: `enemigo`, `pnj`, `criatura`. `stat` es la ficha completa (≤ 80 KB) si el DM decide compartirla. |
| `beast.del` | `id` | DM | Borra la criatura. |
| `beast.auto` | `value` | DM | Activa o apaga el registro automático desde el combate. |
| `beast.get` | `id` | cualquiera | Pide la ficha completa (`beast`). |
| `beast.note` | `id`, `text` | cualquiera | Deja una nota. |
| `beast.unnote` | `id`, `nid` | autor / DM | Borra una nota. |

## Mesa (chat, pizarra, tablero)

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `chat.send` | `text`, `to?` | cualquiera | Mensaje. Con `to` es un susurro entre un jugador y el DM. |
| `chat.roll` | `label`, `total`, `nat?`, `adv?`, `to?` | cualquiera | Tirada compartida (dados físicos). |
| `chat.img` | `img`, `caption?`, `to?` | cualquiera | Imagen ya subida por HTTP. |
| `board.add` / `board.edit` | `item: {cat, title, text}`, `id?`, `img?` | DM | Nota del tablero. `cat`: `mision`, `pnj`, `lugar`, `pista`, `objeto`, `otro`. |
| `board.done` / `board.del` | `id` | DM | Marca como hecha o borra. |
| `draw.add` | `stroke: {color, w, pts, erase?}` | cualquiera | Trazo de la pizarra. |
| `draw.undo` | — | cualquiera | Quita tu último trazo. |
| `draw.clear` | — | DM | Hoja nueva: la actual se archiva. |

## Del servidor al cliente

| `t` | Campos | Cuándo |
|---|---|---|
| `joined` | ver arriba | Al crear o entrar. |
| `state` | `room` | Después de cada cambio, a todos. Cada quien recibe su propia vista. |
| `live` | `live`, `n`, `title` | El DM empezó la sesión. |
| `ended` | `snapshot` | Terminó la sesión: título, horas, chat visible, tablero, hojas de la pizarra y participantes. |
| `mesa.init` | chat, trazos, mapas | Al entrar. |
| `chat`, `draw`, `draw.undo`, `draw.clear` | | Eventos sueltos de la mesa. |
| `map`, `map.meta`, `map.add`, `map.rm`, `map.bg`, `map.fog`, `tok`, `tok.del`, `scene`, `ping` | | Cambios de mapas, solo a quien puede verlos. |
| `beast`, `beast.saved` | | Ficha de una criatura; confirmación al DM. |
| `applied` | `kind`, `amount`, `cond`, `note`, `from` | Alguien te aplicó algo: tu hoja lo aplica y responde con `char`. |
| `yourturn` | `round` | Empieza tu turno. |
| `kicked` | — | El DM te quitó de la campaña. |
| `error` | `code`, `msg` | `msg` ya viene en español. |

`room` incluye `name`, `live`, `session {n, title, started, ended}`, `members` (con `online` y `seen`), `npcs`, `order`, `turnId`, `round`, `maps` (resumen), `scene`, `beasts` (resumen, sin `stat`), `autoBeasts`, `board` y `log`. Para el DM cada PNJ trae además `ac`, `hp`, `hpMax`, `temp` y `hidden`.

`char` (resumen del personaje):

```json
{ "name": "Lyra", "cls": "Paladin 9 / Warlock 2", "lvl": 11, "ac": 21, "hp": 78, "hpMax": 103, "temp": 0, "speed": 30,
  "initMod": 0, "conc": "Bless", "conds": ["prone"], "comps": [{ "name": "Homunculus Servant", "ac": 13, "hp": 10, "hpMax": 10 }] }
```

## Guardado

`server/store.mjs` elige dónde guardar: `DATABASE_URL` → Postgres (tablas `campaigns` y `campaign_images`, se crean solas); `DATA_DIR` → archivos JSON; si no hay ninguno, memoria. Las campañas se guardan cada 4 segundos si cambiaron, se descargan de memoria tras 20 minutos sin uso y se guardan al apagar el servidor.

## Límites

16 miembros, 40 PNJ, 40 mapas, 400 criaturas y 1200 mensajes de chat por campaña; 300 campañas cargadas a la vez; mensajes de hasta 2 MB; 80 mensajes cada 5 segundos por conexión.
