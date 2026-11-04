# Arquitectura

## Idea general

El diario es una sola página sin framework. `tools/build-web.mjs` concatena estilos, iconos, marcado y scripts en `web/dist/index.html` y los minifica con esbuild (`npm run build -- --plain` los deja legibles). Funciona igual servido por el servidor del proyecto, por GitHub Pages o como artefacto de claude.ai.

El motor del mapa va aparte: `web/gl/mapa-gl.js` (PixiJS / WebGL) se empaqueta en `web/dist/mapa-gl.js` y se baja solo al abrir un mapa (o en segundo plano al entrar a una campaña). Sin WebGL, en el artefacto o si falla, el mapa usa Canvas 2D con el mismo dibujo. El servidor manda los archivos de texto comprimidos con brotli o gzip.

El estilo va en `web/styles/*.css` por orden de nombre. Los de la `z` son el sistema visual: materiales por estilo de color (`z0`), componentes (`z1`), hoja (`z2`), combate (`z3`), animaciones (`z4`), ajustes (`z5`), retratos (`z6`), editor del mapa (`z7`), paredes y visión (`z8`), luz, hora y clima (`z9`), pisos y zonas (`za`) y estados del mapa y encuentros (`zb`). Los ornamentos SVG (`a0-ornamentos.css`) se generan con `python3 tools/ornamentos.py` y se usan como máscaras, así toman el oro de cada estilo. Las fuentes viajan con la app (`@fontsource`).

Los scripts se cargan en este orden y cada uno expone un objeto global:

| Archivo | Global | Depende de | Qué hace |
|---|---|---|---|
| `gfx.js` | `Gfx` | — | Calidad gráfica (`localStorage['diario-gfx']`: automática, baja, media, alta), si hay WebGL, resolución y suavizado; carga `mapa-gl.js`. Pone `<html data-gfx>` para que el CSS recorte efectos. Su sección vive en Ajustes (`#gfxBox`). |
| `fx.js` | `Fx` | — | Animaciones en tres niveles (`localStorage['diario-fx']`: sutil, dramática, apagadas; `<html data-motion>`). Su catálogo arma la tabla de Ajustes. `Fx.hp()` (daño y curación, lo llama `save()` cuando cambia la vida), `Fx.announce()` (estandarte de turno, ronda y combate; lo llama `sala.js`), `Fx.crit()`, `Fx.pop()`. |
| `sonido.js` | `Sfx` | — | Sonido sintetizado con Web Audio (sin archivos): efectos, 8 ambientes y 4 músicas generativas, con volumen por canal (`localStorage['diario-sfx']`). `Sfx.ambience(room.amb)` pone lo que eligió el DM. |
| `iconos.js` | `Iconos` | — | Iconos de game-icons.net (CC BY 3.0) para conjuros: por nombre, curación, daño, estado, etiquetas o escuela, sobre el color de la escuela. El build empaqueta solo la lista `GI` en `iconos.svg`, que se baja en segundo plano. |
| `lib.js` | `Lib5e` | — | Importa JSON de 5etools o el paquete, resuelve `_copy`, indexa y busca por tipo, nombre y libro (prefiere 2024). Del bestiario solo guarda compañeros. |
| `render.js` | `Render5e` | `Lib5e` | Convierte `entries` y etiquetas `{@spell …}` en HTML; los enlaces son `a.ref[data-ref="tipo\|nombre\|libro"]`. |
| `rules.js` | `Rules5e` | `Lib5e` | `derive(C)` toma un personaje guardado y devuelve todo lo calculado (`D`) más la lista de elecciones pendientes. Sin DOM: se puede probar en Node. |
| `app.js` | `Diario` | los anteriores | El libro: hoja, conjuros, mochila, rasgos, notas, grimorio, creador, compañeros, traducción, modo combate. |
| `sala.js` | `Sala` | `Diario` | Conexión WebSocket a las campañas: lista guardada (`localStorage['diario-campanas']`), cambiar de campaña, reconexión y la lista de iniciativa. Expone `Sala.on/send` para otros módulos. |
| `mesa.js` | `Mesa` | `Sala` | Pestañas de la mesa: chat, tiradas, imágenes, susurros, pizarra, tablero y guardado de la sesión (Notas + archivo en IndexedDB). |
| `retratos.js` | `Retratos` | `Sala`, `Mesa`, `Iconos` | Retratos y formas del personaje: imagen en IndexedDB (`pt:<personaje>:<forma>`), encuadres en `C.pt` (ficha en círculo y retrato 3:4), editor con gestos, formas sugeridas por especie y clase (revelación del aasimar, forma salvaje, cambiaformas). En una campaña sube solo los recortes de la forma actual y los manda en el resumen (`char.img`, `char.tok`, `char.form`). Busca la imagen de los monstruos en la carpeta 5etools-img del DM. |
| `campana.js` | `Campana` | `Sala`, `Mesa` | Pestaña Inicio: selector de campañas, entrar con código, crear o abrir como DM y el panel del DM (sesión, mapa en pantalla, bestiario, ajustes). Activa la vista ancha `.app.camp-wide`. |
| `bestiario.js` | `Bestiario` | `Sala`, `Render5e` | Bestiario del DM (`bestiario-5e.json`, IndexedDB `bestiary`): buscador, ficha y agregar a la iniciativa. |
| `grupo.js` | `Grupo` | `Sala`, `Bestiario` | Bestiario del grupo: lista, ficha compartida, notas y formulario del DM. |
| `cronica.js` | `Cronica` | `Sala`, `Bestiario` | Separador Bestiario del diario: encuentros de todas las campañas guardados en IndexedDB `encuentros` y acceso al Manual de Monstruos. |
| `assets.js` | `Assets` | — | Objetos del mapa dibujados en SVG (47: estructura, muebles, luz, naturaleza, campamento, mazmorra), cada uno con su tamaño en casillas y su papel (`door`, `stairs`, `light`, `block`…), rasterizados una vez a un lienzo. Tus imágenes importadas (IndexedDB `ulib`), que se suben a la campaña la primera vez que se usan. El panel para elegirlos. |
| `editor.js` | `MapEd` | `Assets` | Editor del mapa: geometría de cada elemento (caja girada), seleccionar tocando o encerrando, mover, girar y escalar con manijas, barra de selección (color, capa, texto, duplicar, girar 90°, borrar), teclado y el historial de deshacer y rehacer por mapa. Trabaja sobre el mapa abierto con la API que le pasa `mapas.js`. |
| `vision.cjs` | `Vision` | — | Motor de visión que comparte con el servidor (`require`): índice de paredes por cubetas, polígono de lo que se ve (rayos a los extremos, DDA por cubetas), descubrir casillas, cuadrícula de paso y caminos (BFS en 8 direcciones, fichas grandes incluidas). Luz: ambiente por hora, luces de fichas y objetos (con su polígono, para que las paredes la tapen), casillas iluminadas, sentidos (visión en la oscuridad, vista ciega) y qué descubre el grupo. Sin DOM. |
| `clima.js` | `Clima` | `Fx` | Lluvia, tormenta, nieve, niebla y viento en un lienzo encima del mapa (`#mapWx`), a ~30 cuadros por segundo y solo mientras se ve; quieto con las animaciones apagadas. |
| `mapas.js` | `Mapas` | `Sala`, `Gfx`, `Vision`, `Clima` | Mesa virtual: datos, permisos, herramientas y gestos; zoom, cuadrícula, capas, trazos, fondo, fichas, paredes y puertas, niebla con visión y luz, hora y clima, zonas (escaleras a otro mapa, trampas, textos, emboscadas) y viajes entre mapas, regla (en recto o rodeando) y señales; estados del mapa (Preparación, Exploración, Combate con despliegue, congelar, cada quien en su turno) con su HUD; herramientas Dibujar y Escena (niebla, luz y clima) encima del juego; el encuentro abierto para acomodar enemigos y zonas de despliegue (`editEnc`). `paint()` solo agenda un cuadro: con WebGL arma una escena (`scene()`) para `MapaGL`, si no dibuja en Canvas 2D. Copia en IndexedDB `map:<id>` e índice `localStorage['diario-mapas']`. |
| `encuentros.js` | `Encuentros` | `Sala`, `Mapas`, `Bestiario`, `Retratos` | Pestaña Encuentros del DM: lista (preparados, en curso y los de antes guardados en el aparato, que pasa a la campaña), ficha (nombre, mapa, notas, enemigos del Manual o a mano con su oleada, oleadas con su ronda), usar, duplicar, guardar el combate de ahora. Guarda cada cambio al rato (`enc.save`); el completo se pide con `enc.get`. |
| `acciones.js` | `Acciones` | `Sala`, `Diario`, `Bestiario`, `Retratos` | Escena de combate (arriba de la sala, `#actBox`): cinta de iniciativa con retratos y el turno en grande; compositor de acciones (armas y conjuros de la hoja con `Diario.actions()`, acciones del Manual con `Bestiario.actionsOf()`, o libre; objetivos; ventaja; espacio del conjuro) y las tarjetas de acción con impacto, salvación y aplicar el daño. |
| `gl/mapa-gl.js` | `MapaGL` | PixiJS | Solo dibuja: recibe la escena ya resuelta y conserva entre cuadros lo que no cambió (papel, cuadrícula, un objeto por trazo, una ficha por id, las paredes, la niebla como textura de una casilla por píxel). Con visión, sube como textura el velo que compuso `mapas.js` (solo cuando cambia), suma el brillo de las luces (blend `add`, parpadea) y tiñe según la hora (blend `multiply`). |

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

## La escena de combate

El combate se puede llevar sin mapa (teatro de la mente). Cada acción es una tarjeta (`c.acts`, las últimas 60) con quién la hace (un enemigo, el DM o un jugador y sus compañeros), qué hace, el ataque (1d20 + bonificador, con ventaja o desventaja; crítico desde 20 o lo que diga) o la salvación (característica, CD, mitad si la supera) y los dados de daño o curación, que tira el servidor (con crítico, el doble de dados). Contra cada objetivo dice si impacta (CA del enemigo o de la hoja del personaje). El daño a un enemigo lo aplica el DM o quien lo hizo; a un personaje, su jugador (le llega `applied` y su hoja lo descuenta). Cada objetivo tira su salvación (el jugador con el modificador de su hoja; el DM con el de la ficha del monstruo). Cada combate lleva un número (`fightN`) y la escena muestra las tarjetas del combate en curso. Lo que ve cada jugador lo recorta el servidor (`cardFor`): ni la CA de los enemigos, ni enemigos ocultos (como autores o como objetivos), y con la vida de los enemigos oculta (nada o cómo se ven) tampoco el daño que reciben, salvo quien lo hizo; el registro guarda una versión para los jugadores (`log[].p`).

De la hoja salen las armas (`D.attacks`, con su daño extra) y los conjuros con tirada (`spellAttack`, `savingThrow`, `{@damage}` o curación; los trucos crecen con `scalingLevelDice` y con un espacio mayor suma lo de `{@scaledamage}`/`{@scaledice}`; lanzarlo gasta el espacio con `quickUse`). Del Manual (el bestiario del DM) salen las acciones de cada monstruo con `{@hit}`, `{@dc}` y `{@actSave}`, sus dados y tipos.

## La mesa

Chat, pizarra y tablero son parte de la campaña. El chat y la pizarra viajan como eventos sueltos (`chat`, `draw`) y el tablero va dentro del estado. Al terminar la sesión, cada quien recibe su resumen (sin los susurros ajenos), lo agrega a las Notas de su personaje y guarda un HTML con el chat, el tablero, las imágenes y las hojas de la pizarra en IndexedDB (`ses:<id>`), descargable desde la pestaña Notas.

## Los mapas

Un mapa es `{cols, rows, grid, layers, strokes, tokens, fog, bg, walls, vis, wrev, light, trig}` en coordenadas de casilla. Un mapa nuevo trae una sola capa; el orden de `layers` es el de dibujo (la última, encima). Los elementos (`strokes`) son trazos (`pen`, `line`), rectángulos y textos que pueden girar (`r`), objetos (`asset`, con su clave `a`, ancho `s` y alto `h`) e imágenes (`img`). Su id lo pone el cliente y `v` sube con cada edición. Las fichas se arrastran (el servidor valida que sea tuya o que seas el DM, y las reglas del estado del mapa); la regla mide con la distancia de D&D (diagonales cuentan 1, 1,5 m por casilla). La niebla es un bit por casilla. Cada aparato guarda una copia en IndexedDB para abrir rápido y revisar los mapas sin conexión.

Las paredes (`walls`) son segmentos con tipo (pared, puerta, puerta secreta, ventana, un sentido, muro bajo, cortina, barrera) y `wrev` sube con cada cambio para que `Vision` rehaga sus índices (cacheados en un `WeakMap`, nunca dentro del mapa). Se trazan en Dibujar → Paredes: arrastrando (un tramo o una habitación), pegándose a otras puntas y a la cuadrícula; tocar una pared con Puerta o Ventana le abre un hueco de una casilla. Entran al mismo historial de deshacer (`wadd`, `wrm`, `wupd`, `wset`). Con la visión puesta (`vis`), el polígono de lo que ve cada ficha del grupo se calcula en el navegador para pintar: negro lo no descubierto, penumbra lo descubierto y limpio lo que se ve ahora; los enemigos fuera de vista no se dibujan para los jugadores. El servidor descubre la niebla (autoritativo) y no deja que un jugador cruce paredes. Los cálculos son baratos (unas décimas de milisegundo por ficha en una mazmorra de 800 paredes), así que no hace falta un Web Worker.

La luz (`light`: hora, luz del lugar y clima) decide qué se percibe con la visión puesta: el ambiente sale de la hora (día brillante; amanecer y atardecer penumbra; noche oscuridad) o lo fija el DM (una mazmorra: oscuridad). Las luces son las de las fichas (`lt`, se eligen en su panel) y las de los objetos que alumbran (antorcha, fogata, vela, farol, la luz invisible…; cualquier objeto puede llevar luz desde la barra de selección). La visión en la oscuridad y la vista ciega salen de la hoja (`D.senses`, de la especie y de rasgos como el Explorador de la penumbra o la Vista del diablo, siguiendo las referencias de los rasgos de subclase) y viajan en el resumen (`char.dv`, `char.bs`). `mapas.js` compone un velo en un lienzo del tamaño del mapa (negro lo no descubierto, penumbra lo explorado, limpio lo que se ve con luz brillante y azulado lo que se ve con poca luz o con visión en la oscuridad), con borde suave, que dibujan igual Canvas 2D y WebGL; aparte va el brillo de las luces (cortado por las paredes, parpadea con WebGL) y el tinte de la hora. El clima se anima en otro lienzo encima (`clima.js`); la niebla espesa limita la vista a 9 m. El panel de cada ficha y el del jugador dicen si está a plena luz, en penumbra o a oscuras y qué dicen las reglas (ligera o muy oscurecida).

Las zonas (`trig`) son rectángulos de casillas que se marcan en Dibujar → Zonas: **paso** (escalera, puerta o salida que lleva a otro mapa y a una zona de llegada, con «Crear la vuelta» para enlazar los dos lados; se puede bloquear u ocultar), **trampa** (avisa al DM; si quiere, también al jugador), **texto** (una descripción que se lee al entrar) y **emboscada** (destapa a los enemigos ocultos del mapa). En la campaña el servidor las dispara cuando una ficha del grupo entra o las cruza (siguiendo su camino) y manda `trig`; en tu copia se disparan en el navegador. Pasar de mapa (`travel`) mueve la ficha y sus compañeros al destino, en casillas libres alrededor de la zona de llegada, y el diario de ese jugador abre el mapa nuevo (`goto`); el DM puede llevar a todo el grupo o a una ficha. Así el grupo se puede separar: cada miembro sabe dónde está (`at`) y el DM puede separar el combate en uno por mapa (`fight.split`: cada mapa con su orden, turno y ronda; el DM ve el del mapa que tiene abierto) y volver a unirlo.

Cada mapa de la campaña tiene un estado (`state`) que pone el DM: **preparación** (`prep`, es lo mismo que oculto: solo el DM lo ve), **exploración** (`explore`: cada quien mueve su ficha) y **combate** (`combat`). En combate, antes de empezar (despliegue) cada jugador se acomoda: dentro de su zona de despliegue si las hay (sin rodear paredes) o donde quiera; ya empezado, con `turnOnly` (de fábrica) solo se mueve quien tiene el turno (su ficha y sus compañeros). `frozen` congela el movimiento de los jugadores en cualquier estado. Empezar el combate pasa a combate los mapas donde están los personajes del orden y quita las zonas de despliegue; terminarlo los regresa a exploración (cambiar el estado de un mapa en combate termina el suyo). Dibujar y Escena ya no son modos: se abren encima con su botón y se guardan con «Listo».

Los encuentros (`c.encs`, solo el DM) son `{id, name, map, notes, npcs[], deploy[], waves[]}`: cada enemigo lleva sus números, su `ref` del Manual, su lugar (`x`, `y`, `s`) y su oleada; las zonas de despliegue son rectángulos (para todo el grupo o para uno, `for`); las oleadas 2 a 9 pueden llegar solas al empezar una ronda (`round`). Se acomodan en el mapa con `Mapas.editEnc` (fichas fantasma y zonas verdes, una oleada resaltada a la vez). Usarlo (`enc.use`) crea los PNJ de la primera oleada con su ficha en su lugar (o cerca del centro), copia las zonas de despliegue al mapa (`trig` con `k: 'despliegue'`, que también ven los jugadores), pasa el mapa a combate y guarda lo que falta en `c.runs[mapa]` (las oleadas pendientes con sus enemigos). Una oleada que llega con el combate empezado tira su iniciativa sola. La iniciativa se puede tirar en el servidor (`init` con `roll`: 1d20 + el modificador de la hoja, con ventaja o desventaja) y el DM tira la de los enemigos de una vez (`init.npcs`, una tirada por tipo).
