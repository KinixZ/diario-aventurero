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
| `amb.set` | `amb: {k?, m?, url?, v?}` o `null` | DM | Ambiente de la mesa para todos: `k` sonido de fondo (`lluvia`, `tormenta`, `viento`, `fuego`, `mazmorra`, `bosque`, `mar`, `taberna`), `m` música (`calma`, `combate`, `taberna`, `misterio`), `url` pista propia (http/https) y `v` volumen 0–1. Va en el estado (`amb`) y se guarda con la campaña. |
| `member.del` | `id` | DM | Quita a un jugador (recibe `kicked`). |
| `session.start` | `title?` | DM | Empieza la sesión N+1. Todos reciben `live`. |
| `session.title` | `title` | DM | Título de la sesión en curso. |
| `session.end` | — | DM | Termina la sesión: cada quien recibe `ended` con su resumen. |
| `char` | `char` | jugador | Actualiza su resumen público (lo manda el diario cada vez que cambia la hoja). Incluye `img` (retrato 3:4), `tok` (ficha en círculo), ids de imágenes ya subidas a la campaña, `form` (la forma que lleva puesta) y sus sentidos en pies, `dv` (visión en la oscuridad) y `bs` (vista ciega), que usa la luz del mapa. |

Fuera de sesión todo sigue disponible: combate, chat, pizarra, tablero, mapas y bestiario. Los mensajes del chat llevan `ses` (número de sesión, o 0 fuera de sesión); el resumen de `ended` usa solo los de esa sesión.

## Combate

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `init` | `value`, `id?` | jugador (el suyo) / DM (cualquiera) | Pone la iniciativa; reordena. |
| `npc.add` | `name`, `ac`, `hp`, `init?`, `count?`, `hidden?`, `ref?`, `initMod?`, `formula?`, `binfo?`, `img?` | DM | Agrega uno o varios PNJ ("Goblin 1", "Goblin 2"…). `ref` = `Nombre|LIBRO` del Manual; `binfo: {type, size}` es lo que se anota en el encuentro. |
| `npc.del` | `id` | DM | Quita un PNJ. |
| `npc.set` | `id`, `hp?`, `hpMax?`, `delta?`, `ac?`, `name?`, `conds?` | DM | Ajusta a mano un enemigo. |
| `npc.reveal` | `id` | DM | Muestra u oculta un PNJ a los jugadores. |
| `hidepc` | `value` | DM | Oculta los PG exactos del grupo entre jugadores. |
| `npchp` | `value`: `none` \| `state` \| `bar` \| `pct` \| `num` | DM | Qué ven los jugadores de la vida de los enemigos. |
| `enc.load` | `enc: {name, npcs[], round, turnName, pcInit{nombre: init}}` | DM | Carga un encuentro guardado. |
| `turn` | `dir`: `start` \| `next` \| `prev` | DM / quien tiene el turno | Avanza el turno; al dar la vuelta sube la ronda. |
| `end` | — | DM | Termina el combate y borra la iniciativa. |
| `apply` | `targets[]`, `kind`, `amount?`, `cond?`, `note?` | jugadores; el DM solo sobre enemigos | `kind`: `damage`, `heal`, `temp`, `cond+`, `cond-`. |

Cuando un monstruo **de los manuales** (con `ref`) entra visible al combate (o el DM lo revela) y el registro automático está activo, se anota solo en el bestiario del grupo como encuentro (`manual: true`), sin el número del nombre ("Goblin 2" → "Goblin"). Los jugadores reciben su `ref` para abrir la entrada en su propio Manual. Los enemigos hechos a mano no se anotan solos.

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
| `fog.all` | `id`, `value` | DM | Cubre o descubre todo. Con la visión puesta, lo que ven ahora los personajes vuelve a quedar descubierto. Apagar la niebla apaga la visión. |
| `map.light` | `id`, `light: {time?, amb?, wx?}` | DM | Hora (`dia`, `amanecer`, `atardecer`, `noche`), luz del lugar (`auto` = según la hora, `bright`, `dim`, `dark`) y clima (`despejado`, `lluvia`, `tormenta`, `niebla`, `nieve`, `viento`). Responde `map.light` y, con la visión puesta, lo que se descubra. |
| `map.vis` | `id`, `on?`, `range?`, `lines?` | DM | Visión de los personajes: prenderla prende la niebla; `range` en casillas (0 = sin límite); `lines`: `auto` (los jugadores ven las líneas de pared si no hay imagen de fondo), `yes` o `no`. Responde `map.vis` y `map.fog`. |
| `wall.add` / `wall.upd` | `id`, `walls: [{id, a: [x, y], b: [x, y], t, open?, lock?, found?, side?}]` | dueño / DM | Pone o cambia paredes (`wall.add` también reemplaza si el id ya existe). Tipos: `wall`, `door`, `secret`, `window`, `oneway`, `low`, `curtain`, `barrier`. Hasta 3000 por mapa. |
| `wall.rm` | `id`, `wids` | dueño / DM | Quita paredes. |
| `trig.add` / `trig.upd` | `id`, `trig: {id, k, x, y, w, h, name, to?: {map, zid?}, lock?, hidden?, text?, once?, fired?, say?, all?}` | DM | Pone o cambia una zona (rectángulo de casillas). `k`: `paso` (lleva a otro mapa y a una zona de llegada; `lock` no deja pasar a los jugadores; `hidden` no la ven), `trampa` (avisa al DM; con `say` también al jugador), `texto` (descripción para quien entra; con `all`, para todos los del mapa) y `encuentro` (destapa a los enemigos ocultos del mapa). `once`: se dispara una sola vez (`fired` queda puesto; quitarlo la rearma). Hasta 200 por mapa. |
| `trig.rm` | `id`, `zid` | DM | Quita una zona. |
| `travel` | `id`, `zid` (jugador o DM) · o `id`, `tid` o `all`, `to: {map, zid?}` (DM) | jugador de cerca / DM | Pasa por una zona de paso: el jugador lleva su ficha y sus compañeros (tiene que estar a 1,5 casillas o menos; bloqueada no). El DM lleva una ficha (`tid`) o a todas las de personaje (`all`) a otro mapa. Llegan a la zona `zid` del destino (o al centro), en casillas libres; si el destino estaba oculto, se destapa. A cada jugador que llega le llega `goto`. |
| `fight.split` | `value` | DM | Separa el combate: un orden, turno y ronda por mapa (cada quien en el mapa donde está su ficha). `false` los une en uno solo (sigue el turno del mapa que el DM tiene abierto). |
| `fight.focus` | `map` | DM | El combate que ve y maneja el DM con el combate separado (lo manda el diario al abrir un mapa). |
| `door` | `id`, `wid`, `open?` | cualquiera (de cerca) / DM | Abre o cierra una puerta (sin `open`, la alterna). Un jugador necesita una ficha suya a 2 casillas o menos y que no tenga llave (`locked`, `far`). Abrir una secreta la marca encontrada. |
| `tok.add` | `id`, `tok: {x, y, s, name, color, img?, kind, ref?, hidden?, comp?, lt?, sn?}` | cualquiera | Pone una ficha. `kind`: `pc`, `npc`, `obj`. La ficha propia de un jugador es única por mapa: ponerla otra vez la mueve. Hasta 5 fichas por jugador y 120 por mapa. |
| `tok.move` | `id`, `tid`, `x`, `y` | dueño / DM | Mueve una ficha. Si una ficha de personaje entra a una zona (o la cruza), se dispara: ver `trig`. Con paredes, la de un jugador va en recto o rodeando; si no hay camino, el servidor le regresa la ficha (`tok`) y un `error` `blocked`. El DM pasa por donde sea. Con la visión puesta, descubre lo que la ficha ve en el camino. |
| `tok.set` | `id`, `tid`, `name?`, `s?`, `color?`, `img?`, `hidden?`, `ref?`, `lt?`, `sn?` | dueño / DM (`hidden`, `ref` solo DM) | Ajusta una ficha. `lt: {k?, b, d, c, f?}` es la luz que lleva (radios en casillas: `b` brillante y `d` penumbra más allá; `null` la quita). `sn: {dv?, bs?}` cambia sus sentidos en pies (lo que no se ponga sale de la hoja). |
| `tok.del` | `id`, `tid` | dueño / DM | Quita una ficha. |
| `scene.set` | `id?` | DM | Muestra ese mapa a todos (lo destapa si estaba oculto). Sin `id` lo quita. |
| `map.ping` | `id`, `x`, `y`, `color?` | quien lo ve | Señala un punto (pulsación larga). |

La niebla viaja como base64 de un bit por casilla (`fog.cells`, 1 = descubierta). Los jugadores no reciben capas del DM, fichas ocultas ni mapas ocultos, y las puertas secretas sin encontrar les llegan como paredes (`wall`); ya encontradas, como puertas.

### Paredes, visión y luz

Una pared es un segmento entre dos puntos en casillas (`a`, `b`) con un tipo (`t`):

| Tipo | Tapa la vista | Tapa el paso |
|---|---|---|
| `wall` pared | sí | sí |
| `door` puerta | cerrada sí | cerrada sí |
| `secret` puerta secreta | cerrada sí | cerrada sí |
| `window` ventana | no | sí |
| `oneway` un sentido | desde un lado (`side`) | sí |
| `low` muro bajo | no | no |
| `curtain` cortina | sí | no |
| `barrier` barrera invisible | no | sí |

El servidor y el navegador usan el mismo motor (`web/src/vision.cjs`). Con `vis.on`, el servidor descubre en la niebla lo que ven las fichas de personaje del grupo (visión compartida; no cuentan las ocultas, las caídas ni las cegadas o inconscientes) cuando se ponen, se mueven, se abre una puerta o cambian las paredes, y manda `map.fog` si algo cambió. Lo que el grupo ve en este momento lo calcula cada navegador.

La luz cuenta para lo que se descubre: con luz brillante o penumbra en el lugar se ve todo lo que está a la vista; a oscuras, solo lo que alumbra alguna luz o lo que alcanzan los sentidos de la ficha (visión en la oscuridad, vista ciega o su propia luz). Las luces son las de las fichas (`lt`) y las de los objetos que alumbran solos (antorcha, brasero, fogata, candelabro, vela, farol, cristal y la luz invisible `luz`) o los que tienen `lt` puesto (`{off: 1}` apaga uno); las paredes que tapan la vista también tapan la luz, y las luces de capas solo-DM no alumbran. Con niebla espesa no se ve más allá de 9 m.


### Editar el mapa

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `map.add` | `id`, `stroke` o `strokes[]` (hasta 100) | quien ve el mapa (capas «Solo DM», el DM) | Agrega elementos. El id lo propone el cliente (`k…`); si está repetido o no sirve, el servidor pone otro. |
| `map.upd` | `id`, `strokes[]` (con su `id`) | el DM todo; cada quien lo suyo | Reemplaza elementos ya puestos: mover, girar, escalar, color, capa o texto. Si el DM pasa uno a una capa secreta, a los jugadores les llega `map.rm`. |

Elementos: `{id, l, k, c, w, pts, v?}` con `k` = `pen` \| `line` \| `rect` \| `text` \| `asset` \| `img`. `rect`, `text`, `asset` e `img` aceptan `r` (grados); `text` lleva `t` y puede llevar `fs` (tamaño en casillas); `asset` lleva `a` (clave del objeto), `s` y `h` (casillas); `img` lleva `img` (id de una imagen de la campaña), `s` y `h`. `asset` e `img` aceptan `lt` (su luz: `{k?, b, d, c, f?}` o `{off: 1}` para apagar la propia).

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
| `board.add` / `board.edit` | `item: {cat, title, text, prio?, look?}`, `id?`, `img?` | DM | Nota del tablero. `cat`: `mision`, `pnj`, `lugar`, `pista`, `objeto`, `otro`. Las misiones llevan `prio` (`main` o `side`) y las principales `look` (`paper` o `scroll`). Editar no cambia si estaba cumplida. |
| `board.done` / `board.del` | `id` | DM | Marca como hecha o borra. |
| `draw.add` | `stroke: {color, w, pts, erase?}` | cualquiera | Trazo de la pizarra compartida (la app ya no la muestra: los dibujos se adjuntan al chat como imagen con `chat.img`). |
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
| `map`, `map.meta`, `map.add`, `map.rm`, `map.bg`, `map.fog`, `map.vis`, `map.light`, `tok`, `tok.del`, `scene`, `ping` | | Cambios de mapas, solo a quien puede verlos. |
| `walls` | `id`, `put`, `del`, `wrev` | | Paredes nuevas o cambiadas (`put`) y quitadas (`del`); a los jugadores, con las secretas disfrazadas. |
| `trigs` | `id`, `put`, `del` | | Zonas nuevas, cambiadas o quitadas. Los jugadores solo reciben los pasos que no están ocultos (con `to.name`, el nombre del mapa al que llevan). |
| `trig` | `id`, `k`, `zid`, `name`, `text?`, `who?`, `to?`, `lock?`, `dm?` | | Alguien entró a una zona. Al jugador que pisa un paso le pregunta si pasa; el texto, a quien entra (o a todos los del mapa); la trampa, al DM (y al jugador si `say`); la emboscada, a los del mapa. Al DM le llega todo con `dm: true` y `who`. |
| `goto` | `map`, `name` | | Tu ficha pasó a ese mapa: el diario lo abre. |
| `beast`, `beast.saved` | | Ficha de una criatura; confirmación al DM. |
| `applied` | `kind`, `amount`, `cond`, `note`, `from` | Alguien te aplicó algo: tu hoja lo aplica y responde con `char`. |
| `yourturn` | `round` | Empieza tu turno. |
| `kicked` | — | El DM te quitó de la campaña. |
| `error` | `code`, `msg` | `msg` ya viene en español. |

`room` incluye `name`, `live`, `session {n, title, started, ended}`, `members` (con `online`, `seen` y `at`, el mapa donde está su ficha), `npcs` (con `at`), `order`, `turnId`, `round` (con el combate separado, los del combate de tu mapa; además `split`, `fight` y, para el DM, `fights: [{map, name, round, turnId, n}]`), `maps` (resumen), `scene`, `beasts` (resumen, sin `stat`), `autoBeasts`, `board` y `log`. Para el DM cada PNJ trae además `ac`, `hp`, `hpMax`, `temp` y `hidden`.

`char` (resumen del personaje):

```json
{ "name": "Lyra", "cls": "Paladin 9 / Warlock 2", "lvl": 11, "ac": 21, "hp": 78, "hpMax": 103, "temp": 0, "speed": 30,
  "initMod": 0, "conc": "Bless", "conds": ["prone"], "comps": [{ "name": "Homunculus Servant", "ac": 13, "hp": 10, "hpMax": 10 }],
  "img": null, "tok": null, "form": null, "dv": 60, "bs": 0 }
```

## Guardado

`server/store.mjs` elige dónde guardar: `DATABASE_URL` → Postgres (tablas `campaigns` y `campaign_images`, se crean solas); `DATA_DIR` → archivos JSON; si no hay ninguno, memoria. Las campañas se guardan cada 4 segundos si cambiaron, se descargan de memoria tras 20 minutos sin uso y se guardan al apagar el servidor.

## Límites

16 miembros, 40 PNJ, 40 mapas, 400 criaturas y 1200 mensajes de chat por campaña; 300 campañas cargadas a la vez; mensajes de hasta 2 MB; 80 mensajes cada 5 segundos por conexión.
