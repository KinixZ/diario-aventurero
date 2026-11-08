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
| `init` | `value` o `roll`: `n` \| `adv` \| `dis`, `id?` | jugador (el suyo) / DM (cualquiera) | Pone la iniciativa (escrita) o la tira el servidor: 1d20 (con ventaja o desventaja) + `initMod` de la hoja o del enemigo; queda en el registro con los dados. Reordena. |
| `init.npcs` | `map?`, `group?` | DM | Tira la iniciativa de los enemigos que no la tienen (con el combate separado, los del mapa). `group`: los del mismo tipo comparten tirada. |
| `npc.add` | `name`, `ac`, `hp`, `init?`, `roll?`, `count?`, `hidden?`, `ref?`, `initMod?`, `formula?`, `binfo?`, `img?`, `reach?` | DM | Agrega uno o varios PNJ ("Goblin 1", "Goblin 2"…; si ya hay del mismo nombre, la numeración sigue). `roll`: sin `init`, el servidor tira 1d20 + `initMod` una vez para todos (o toma la de los que ya había con ese nombre). `ref` = `Nombre|LIBRO` del Manual; `binfo: {type, size}` es lo que se anota en el encuentro; `reach`, su alcance cuerpo a cuerpo en casillas (para los ataques de oportunidad). |
| `npc.del` | `id` | DM | Quita un PNJ. |
| `npc.set` | `id`, `hp?`, `hpMax?`, `delta?`, `ac?`, `name?`, `conds?` | DM | Ajusta a mano un enemigo. |
| `npc.reveal` | `id` | DM | Muestra u oculta un PNJ a los jugadores. |
| `hidepc` | `value` | DM | Oculta los PG exactos del grupo entre jugadores. |
| `npchp` | `value`: `none` \| `state` \| `bar` \| `pct` \| `num` | DM | Qué ven los jugadores de la vida de los enemigos. |
| `enc.load` | `enc: {name, npcs[], round, turnName, pcInit{nombre: init}}` | DM | (De antes) Carga un combate guardado en el aparato, reemplazando a los enemigos. |
| `enc.save` | `enc: {id?, name, map?, notes?, npcs[{k, name, ac, hp, hpMax, ref?, initMod?, formula?, img?, binfo?, s?, color?, x?, y?, wave?, hidden?}], deploy[{id, x, y, w, h, name?, for?}], waves[{n, name?, round?}]}` | DM | Crea o reemplaza un encuentro (el id lo puede poner el cliente: `E…`). Hasta 40 encuentros, 40 enemigos, 12 zonas de despliegue y oleadas 2 a 9. Responde `enc` con el encuentro limpio. |
| `enc.get` / `enc.del` | `id` | DM | Pide un encuentro completo (`enc`) o lo borra. |
| `enc.use` | `id` | DM | Empieza el encuentro: los enemigos de la oleada 1 entran al combate con su ficha en su lugar, las zonas de despliegue van al mapa, el mapa pasa a combate (y se destapa) y a cada jugador le llega `combat`. Si ya había uno en ese mapa (o sin mapa), sus enemigos se quitan. |
| `enc.wave` | `map?`, `n` | DM | Suelta ya la oleada `n` del encuentro en curso de ese mapa (sin `map`, el que no tiene mapa). Las que tienen `round` llegan solas al empezar esa ronda. A los del mapa les llega `wave`. |
| `enc.join` | `map` | jugador | Se une al combate de ese mapa: su ficha (y sus compañeros, si venía de otro mapa) llega a su zona de despliegue o cerca del centro; si no tenía ficha, se le pone una. Le llega `goto`. |
| `turn` | `dir`: `start` \| `next` \| `prev` | DM / quien tiene el turno | Avanza el turno; al dar la vuelta sube la ronda. Al terminar un turno, las zonas de conjuro que dañan «al terminar ahí» y las salvaciones repetidas sacan su tarjeta; al empezar el siguiente, las de «al empezar». |
| `end` | `all?`, `map?` | DM | Termina el combate y borra la iniciativa (con el combate separado, solo el del mapa, salvo `all`). Los mapas en combate vuelven a exploración, sin zonas de despliegue ni oleadas pendientes. |
| `apply` | `targets[]`, `kind`, `amount?`, `cond?`, `note?` | jugadores; el DM solo sobre enemigos | `kind`: `damage`, `heal`, `temp`, `cond+`, `cond-`. |
| `act.post` | `act: {actor? (DM: id de un enemigo; si no, narrador), comp? (jugador: nombre de su compañero), title, text?, atk?: {bonus, k?: adv\|dis, critOn?, melee?, autoCrit?}, save?: {ab, dc, half?}, dmg?: [{dice, type?}], heal?, targets: [ids], map?, area?, self?, zone?, conds?, repeat?, conc?, man?}` | todos | Publica una acción: el servidor tira el ataque (1d20, con ventaja o desventaja) y los dados (`2d6 + 3`, `1d8 + 1d6`; con crítico, el doble de dados; hasta 80 dados) y dice si impacta a cada objetivo contra su CA (un 20 siempre, un 1 nunca). Llega `act` a cada quien. En el mapa (`map`): la tarjeta lleva de dónde sale (`from`) y dónde está cada objetivo (`at`), y la **cobertura** de cada uno con las paredes y las criaturas en medio (`cover`: 2, 5 o `total`), que suma a la CA (con total, no impacta) y a la salvación de Destreza. `area`: `{t: sphere\|cylinder\|cube\|cone\|line, x, y, r?\|w?\|a, l}` en casillas (`self`: sale de quien actúa). `autoCrit`: contra un paralizado o inconsciente a 1,5 m, el impacto es crítico. `conds`: estados que impone (`repeat`: se repite la salvación al final de cada turno). `conc`: concentración (termina la anterior de quien actúa). `zone: {on: [enter, end, start], terrain?, obscure?, move?, follow?, r?}`: la zona que se queda en el mapa (ver `fx`). `man: {d20: [n, n?], dmg: [total…]}`: dados físicos (lo que salió). |
| `act.apply` | `id`, `tid`, `how`: `full` \| `half` \| `none` | a un enemigo: el DM o quien publicó; a un personaje: su jugador | Aplica el daño o la curación de la tarjeta a ese objetivo (una vez). Al jugador le llega `applied` para su hoja. Si el objetivo se concentraba, aparece una tarjeta de salvación de Constitución (CD 10 o la mitad del daño, hasta 30). |
| `act.save` | `id`, `tid`, `mod`, `k?`, `fail?`, `man?` | el objetivo (el DM por los enemigos) | Tira la salvación de ese objetivo: 1d20 + `mod` (+ su cobertura, si es de Destreza) contra la CD (un 20 la supera, un 1 la falla). `fail`: falla sola por un estado (paralizado, aturdido…). `man`: dados físicos. Superar una salvación repetida libra del estado; fallar la de concentración la termina. |
| `act.cond` | `id`, `tid` | a un enemigo: el DM o quien publicó; a un personaje: su jugador | Aplica los estados de la tarjeta a ese objetivo (al enemigo en el servidor; al jugador le llega `applied` `cond+`). Con `repeat`, queda su salvación repetida al final de cada uno de sus turnos (una tarjeta nueva, con `eff`). |
| `death` | `man?` | jugador con 0 PG | Salvación contra la muerte: el servidor tira el d20 (o usa el físico), publica la tarjeta (`death: {nat, res}`) y a la hoja le llega `applied` `death`. |
| `act.del` | `id` | quien la publicó / DM | Quita una tarjeta. |

Cuando un monstruo **de los manuales** (con `ref`) entra visible al combate (o el DM lo revela) y el registro automático está activo, se anota solo en el bestiario del grupo como encuentro (`manual: true`), sin el número del nombre ("Goblin 2" → "Goblin"). Los jugadores reciben su `ref` para abrir la entrada en su propio Manual. Los enemigos hechos a mano no se anotan solos.

## Mapas (tablero de juego)

| `t` | Campos | Quién | Qué hace |
|---|---|---|---|
| `map.save` | `map: {id, name, cols, rows, grid, layers, strokes, hidden?}` | cualquiera (el DM los suyos ocultos) | Crea o reemplaza un mapa. `grid`: `square`, `hex` o `none`. |
| `map.meta` | `id`, `name?`, `grid?`, `layers?` | dueño / DM | Cambia nombre, cuadrícula o capas. Una capa con `dm: true` solo la ve el DM. |
| `map.hide` | `id`, `value` | DM | Oculta el mapa mientras lo prepara (lo pasa a preparación; mostrarlo, a exploración). |
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
| `trig.rm` | `id`, `zid` | DM | Quita una zona. La zona `k: 'dificil'` es terreno difícil: la ven los jugadores y en combate cada casilla cuesta el doble. |
| `travel` | `id`, `zid` (jugador o DM) · o `id`, `tid` o `all`, `to: {map, zid?}` (DM) | jugador de cerca / DM | Pasa por una zona de paso: el jugador lleva su ficha y sus compañeros (tiene que estar a 1,5 casillas o menos; bloqueada no). El DM lleva una ficha (`tid`) o a todas las de personaje (`all`) a otro mapa. Llegan a la zona `zid` del destino (o al centro), en casillas libres; si el destino estaba oculto, se destapa. A cada jugador que llega le llega `goto`. |
| `map.state` | `id`, `state`: `prep` \| `explore` \| `combat` | DM | Estado del mapa. Preparación lo oculta a los jugadores (es lo mismo que `map.hide`); exploración lo muestra; combate prepara el despliegue (a los jugadores del mapa les llega `combat`). Salir de combate termina el combate de ese mapa. Empezar el combate pasa a combate los mapas donde están los personajes del orden. |
| `map.play` | `id`, `frozen?`, `turnOnly?` | DM | `frozen`: los jugadores no mueven fichas ni viajan (las puertas sí). `turnOnly` (de fábrica): en combate empezado, cada jugador mueve sus fichas solo en su turno. Antes de empezar, cada quien se acomoda en su zona de despliegue (si hay) sin rodear paredes; fuera de ella la ficha vuelve con un `error` `deploy`. Congelado: `frozen`; fuera de turno: `not_your_turn`. |
| `fight.split` | `value` | DM | Separa el combate: un orden, turno y ronda por mapa (cada quien en el mapa donde está su ficha). `false` los une en uno solo (sigue el turno del mapa que el DM tiene abierto). |
| `fight.focus` | `map` | DM | El combate que ve y maneja el DM con el combate separado (lo manda el diario al abrir un mapa). |
| `door` | `id`, `wid`, `open?` | cualquiera (de cerca) / DM | Abre o cierra una puerta (sin `open`, la alterna). Un jugador necesita una ficha suya a 2 casillas o menos y que no tenga llave (`locked`, `far`). Abrir una secreta la marca encontrada. |
| `tok.add` | `id`, `tok: {x, y, s, name, color, img?, kind, ref?, hidden?, comp?, lt?, sn?}` | cualquiera | Pone una ficha. `kind`: `pc`, `npc`, `obj`. La ficha propia de un jugador es única por mapa: ponerla otra vez la mueve. Hasta 5 fichas por jugador y 120 por mapa. |
| `tok.move` | `id`, `tid`, `x`, `y` | dueño / DM | Mueve una ficha. En pleno combate (con el movimiento limitado del mapa), la ficha de un jugador gasta su velocidad en la ronda: el camino más barato rodeando paredes, el terreno difícil doble (volando no cuenta); si no le alcanza, vuelve con un `error` `speed` y le llega `mv`. Al salir del alcance de un enemigo que puede reaccionar, a quien lo controla le llega `oa` (salvo con Retirarse). Al entrar a una zona de conjuro con «al entrar», su tarjeta. Si una ficha de personaje entra a una zona (o la cruza), se dispara: ver `trig`. Con paredes, la de un jugador va en recto o rodeando; si no hay camino, el servidor le regresa la ficha (`tok`) y un `error` `blocked`. El DM pasa por donde sea. Con la visión puesta, descubre lo que la ficha ve en el camino. Las reglas del estado del mapa van antes: congelado, despliegue y turno (ver `map.play`). |
| `tok.set` | `id`, `tid`, `name?`, `s?`, `color?`, `img?`, `hidden?`, `ref?`, `lt?`, `sn?`, `z?` | dueño / DM (`hidden`, `ref` solo DM) | Ajusta una ficha. `z`: altura de vuelo en casillas (0 a 60; cuenta para la distancia y el alcance). `lt: {k?, b, d, c, f?}` es la luz que lleva (radios en casillas: `b` brillante y `d` penumbra más allá; `null` la quita). `sn: {dv?, bs?}` cambia sus sentidos en pies (lo que no se ponga sale de la hoja). |
| `tok.del` | `id`, `tid` | dueño / DM | Quita una ficha. |
| `scene.set` | `id?` | DM | Muestra ese mapa a todos (lo destapa si estaba oculto). Sin `id` lo quita. |
| `map.tac` | `id`, `mov?`, `oa?`, `flank?` | DM | Reglas del combate en el mapa: movimiento limitado por la velocidad (de fábrica), avisos de ataques de oportunidad (de fábrica) y flanqueo (regla opcional: ventaja al tener un aliado al otro lado). Llega en `map.play` como `tac`. |
| `mv.set` | `id`, `tid`, `dash?`, `dis?`, `stand?` | dueño / DM | En la ronda: Correr (duplica el movimiento), Retirarse (no provoca ataques de oportunidad) o levantarse (gasta la mitad de la velocidad). Responde `mv`. |
| `fx.move` | `id`, `fid`, `x`, `y` | quien lo lanzó (si se mueve) / DM | Mueve una zona de conjuro (Nube de dagas, Rayo de luna…); quien queda dentro recibe su tarjeta. |
| `fx.rm` | `id`, `fid` | quien lo lanzó / DM | Quita una zona de conjuro. |
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
| `mesa.init` | chat, trazos, `acts` (las últimas tarjetas que puedes ver), `fightN` | Al entrar. |
| `chat`, `draw`, `draw.undo`, `draw.clear` | | Eventos sueltos de la mesa. |
| `map`, `map.meta`, `map.add`, `map.rm`, `map.bg`, `map.fog`, `map.vis`, `map.light`, `tok`, `tok.del`, `scene`, `ping` | | Cambios de mapas, solo a quien puede verlos. |
| `walls` | `id`, `put`, `del`, `wrev` | | Paredes nuevas o cambiadas (`put`) y quitadas (`del`); a los jugadores, con las secretas disfrazadas. |
| `trigs` | `id`, `put`, `del` | | Zonas nuevas, cambiadas o quitadas. Los jugadores solo reciben los pasos que no están ocultos (con `to.name`, el nombre del mapa al que llevan) y las zonas de despliegue (`k: 'despliegue'`, con `for` si es de alguien). |
| `trig` | `id`, `k`, `zid`, `name`, `text?`, `who?`, `to?`, `lock?`, `dm?` | | Alguien entró a una zona. Al jugador que pisa un paso le pregunta si pasa; el texto, a quien entra (o a todos los del mapa); la trampa, al DM (y al jugador si `say`); la emboscada, a los del mapa. Al DM le llega todo con `dm: true` y `who`. |
| `goto` | `map`, `name` | | Tu ficha pasó a ese mapa: el diario lo abre. |
| `map.play` | `id`, `state`, `frozen`, `turnOnly`, `tac` | | Cambió el estado del mapa o sus reglas de movimiento (`tac: {mov, oa, flank}`). |
| `fx` | `id`, `put`, `del` | | Zonas de conjuro nuevas, cambiadas o quitadas: `{id, name, by, ck, conc, on, terrain, obscure, move, dtype, sh? (forma) \| tok + r (sigue a esa ficha), act?: {save, dmg, heal}}`. Las de enemigos ocultos, solo al DM. Con `obscure`, la zona tapa la vista como una pared (visión de las fichas y niebla). |
| `mv` | `id`, `tid`, `u`, `max`, `dash`, `dis` | | Cuánto movimiento lleva gastado esa ficha en su ronda y cuánto tiene (en casillas), al dueño y al DM. |
| `oa` | `map`, `by`, `byName`, `target`, `targetName`, `tok` | | Alguien salió del alcance de tu enemigo (o del tuyo): puede hacerle un ataque de oportunidad. |
| `combat` | `map`, `name`, `enc?` | | Hay combate en ese mapa (o sin mapa): quien está ahí se acomoda y tira iniciativa; quien no, se puede unir (`enc.join`). |
| `wave` | `map`, `n`, `name` | | Llegó una oleada de refuerzos (solo si alguno se ve). |
| `enc` | `enc` | | Un encuentro completo (al DM). |
| `act` / `act.del` | `card` / `id` | | Una tarjeta de acción nueva o cambiada (impacto, salvaciones, lo aplicado) o quitada. Cada quien la recibe recortada: sin la CA de los enemigos ni enemigos ocultos; con su vida oculta, sin el daño que reciben (salvo quien lo hizo). |
| `beast`, `beast.saved` | | Ficha de una criatura; confirmación al DM. |
| `applied` | `kind`, `amount`, `cond`, `note`, `from` | Alguien te aplicó algo: tu hoja lo aplica y responde con `char`. |
| `yourturn` | `round` | Empieza tu turno. |
| `kicked` | — | El DM te quitó de la campaña. |
| `error` | `code`, `msg` | `msg` ya viene en español. |

`room` incluye `mv` (lo gastado por tus fichas en su ronda: `{ficha: {u, max, dash, dis}}`; el DM, todas), `name`, `live`, `session {n, title, started, ended}`, `members` (con `online`, `seen` y `at`, el mapa donde está su ficha), `npcs` (con `at`), `order`, `turnId`, `round` (con el combate separado, los del combate de tu mapa; además `split`, `fight` y, para el DM, `fights: [{map, name, round, turnId, n}]`), `fightN` (el número del combate, para agrupar las tarjetas), `maps` (resumen, con `state` y `frozen`), `scene`, para el DM `encs` (resumen: `{id, name, map, n, placed, waves, deploy, updated}`) y `runs` (encuentros en curso: `{key, map, enc, name, waves: [{n, name, round, count}]}` con las oleadas que faltan), `beasts` (resumen, sin `stat`), `autoBeasts`, `board` y `log`. Para el DM cada PNJ trae además `ac`, `hp`, `hpMax`, `temp` y `hidden`.

`char` (resumen del personaje):

```json
{ "name": "Lyra", "cls": "Paladin 9 / Warlock 2", "lvl": 11, "ac": 21, "hp": 78, "hpMax": 103, "temp": 0, "speed": 30,
  "initMod": 0, "conc": "Bless", "conds": ["prone"], "comps": [{ "name": "Homunculus Servant", "ac": 13, "hp": 10, "hpMax": 10 }],
  "img": null, "tok": null, "form": null, "dv": 60, "bs": 0, "exh": 0, "ds": { "s": 1, "f": 0 }, "reach": 1, "idc": "#6e0f12", "on": ["aura"] }
```

`exh`: nivel de cansancio (reglas 2024: −2 a las tiradas d20 y −1,5 m de velocidad por nivel). `ds`: salvaciones contra la muerte (éxitos, fallos, `stable`, `dead`). `reach`: alcance cuerpo a cuerpo en casillas (con un arma de alcance, 2). `idc`: el color de su subclase (`#rrggbb`, para el aro de su ficha en el mapa). `on`: los estados de clase que tiene encendidos (`rage`, `wild`, `bladesong`, `aura`…; hasta 6), que dan un halo a su ficha. Cuando el jugador deja de concentrarse en su hoja (`conc` pasa a nada), sus zonas y los estados de su conjuro se acaban.

## Guardado

`server/store.mjs` elige dónde guardar: `DATABASE_URL` → Postgres (tablas `campaigns` y `campaign_images`, se crean solas); `DATA_DIR` → archivos JSON; si no hay ninguno, memoria. Las campañas se guardan cada 4 segundos si cambiaron, se descargan de memoria tras 20 minutos sin uso y se guardan al apagar el servidor.

## Límites

16 miembros, 60 PNJ, 40 mapas, 40 encuentros, 30 zonas de conjuro por mapa, 100 estados con salvación repetida, 400 criaturas y 1200 mensajes de chat por campaña; 300 campañas cargadas a la vez; mensajes de hasta 2 MB; 80 mensajes cada 5 segundos por conexión.
