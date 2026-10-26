# Diario del Aventurero

Hoja de personaje de D&D 5e con forma de diario de cuero: se abre deslizando la tapa, tiene separadores por sección y un modo combate tipo HUD. Calcula todo con los datos de **5etools** que cada quien carga desde su propia copia, y trae **salas de combate en tiempo real** para que el grupo comparta iniciativa, PG, condiciones y efectos.

Pensado primero para el teléfono; en laptop se ve como libro abierto a doble página.

**Para jugar:** https://diario-aventurero.onrender.com

1. Ajustes → Biblioteca de 5etools → Elegir archivo → `diario-5e.json`.
2. Ajustes → Personajes → Importar personajes (si ya tenías uno en otro dispositivo) o crea uno nuevo.
3. Modo combate → Crear sala (o Entrar con el código de 4 letras que te pasen).

El servidor gratis se duerme tras 15 minutos sin uso: la primera vez que lo abras en la sesión tarda unos segundos.

**Instalarlo como app:** en Android (Chrome), menú ⋮ → *Instalar app*. En iPhone (Safari), Compartir → *Agregar a inicio*. Una vez abierto, funciona sin internet; las salas de combate sí necesitan conexión.

## Qué hace

- **Creador nivel por nivel**: clase, origen, características, habilidades, conjuros, equipo. No deja subir de nivel hasta que eliges lo de ese nivel (dotes, invocaciones, conjuros, PG).
- **Reglas mezcladas 2014/2024**: clases 2024 con subclases 2014, artífice de Tasha y de *Forge of the Artificer*, dotes de todos los libros con sus requisitos.
- **Multiclase**: requisitos de 13, competencias de multiclase, PG con el dado de cada clase, espacios combinados con la tabla de multiclase y Pacto aparte.
- **Dados físicos**: el diario no tira, te dice qué tirar ("Tira 1d20 + 8").
- **Grimorio enlazado**: reglas, acciones, condiciones, conjuros, objetos y dotes con hipervínculos; filtros por clase, nivel, escuela, concentración y ritual; vista de tabla.
- **Mochila tipo Resident Evil 4** con contenedores (mochila, Bag of Holding, sacos, carcajes…) y equipo por ranura.
- **Homebrew**: armas, armaduras, escudos, objetos mágicos (bonos a CA, salvaciones, conjuros y armas; características fijas o sumadas; resistencias; cargas), consumibles y objetos sueltos. Los objetos mágicos de 5etools también suman sus bonos.
- **Rasgos ordenados**: agrupados por clase, subclase, especie, dotes y homebrew, con buscador y filtro «En combate / Pasivos». Cada rasgo muestra si cuesta acción, adicional o reacción, sus usos y una línea de resumen; los que usas en combate van primero.
- **Habilidades homebrew**: nombre, coste (acción, adicional, reacción, gratis o pasiva), usos (fijos, tu competencia, tu modificador o tu nivel) con recarga en descanso corto o largo, tirada de ataque o salvación con su CD, dados y tipo de daño, alcance y descripción. Cuentan como recursos y van al acceso rápido.
- **Acceso rápido en combate**: conjuros (con botones por nivel de espacio), rasgos, habilidades y pociones a un toque; al usarlos se gasta el espacio, la carga o el objeto y se marca tu acción. Las armas guardadas se equipan desde ahí.
- **Iconos estilo Baldur's Gate 3** (opcional, en Ajustes): acción en círculo verde, adicional en triángulo naranja, reacción en morado y espacios de conjuro en cuadros azules.
- **12 estilos** de color (claros y de páginas oscuras); el modo combate toma los colores del estilo.
- **Compañeros**: homúnculo, defensor de acero, compañeros de Beast Master y Drakewarden, familiares e invocaciones con sus números calculados (formas, nivel del conjuro, tu competencia y tus modificadores). También **hojas propias** para mascotas y compañeros homebrew, o para convertir uno de la biblioteca en hoja editable.
- **Traducción automática** de textos (traductor del navegador o Claude cuando corre como artefacto).
- **Sala de combate**: código de 4 letras, iniciativa ordenada, turnos y rondas (aparecen cuando el DM empieza el combate), daño, curación, PG temporales y condiciones entre jugadores.
- **Mesa de juego**: el DM abre la mesa y todos entran con el código. Pestañas de **Chat** (notas de la sesión, tiradas compartidas, imágenes del DM y susurros), **Pizarra** (dibujo con el dedo, colores, borrador, hojas), **Tablero** (misión, PNJ, lugares y pistas fijados por el DM) y **Combate**. Al terminar, la sesión se guarda en las Notas de cada quien y como archivo descargable con el chat y los dibujos.
- **Vista del DM**: sin hoja propia; crea enemigos y lleva su vida, CA, iniciativa y estados (ocultos o visibles para el grupo). Sus acciones las maneja fuera de la app.
- **Bestiario del DM** (archivo aparte, ver abajo): busca entre los monstruos de tu 5etools por nombre, VD, tipo y libro; ve su ficha con los ataques listos para tirar («Tira 1d20 + 6 · 2d8 + 4 contundente») y agrégalos a la iniciativa con su CA, PG y modificador.
- **Vida de los enemigos a elección del DM**: los jugadores ven nada, cómo se ve («herido»), solo la barra, la barra con porcentaje o los números.
- **Encuentros guardados**: el DM guarda el combate a la mitad (enemigos con vida y estados, iniciativa de todos, ronda y turno) y lo carga en otra sesión. Si el servidor se reinicia, la mesa vuelve con el combate.
- **Mapas de las zonas**: lienzos grandes con cuadrícula cuadrada o hexagonal, capas (terreno, paredes, notas…), lápiz, líneas, rectángulos, texto y borrador; zoom con dos dedos. En la mesa dibujan todos a la vez y cada teléfono guarda los mapas para revisarlos después; se pueden bajar como imagen.

## Bestiario del DM

El DM carga un segundo archivo con los enemigos; los jugadores no lo necesitan. Se crea desde la misma copia de 5etools:

```bash
npm run bestiario -- ./5etools-src/data ./bestiario-5e.json
```

Luego, en el teléfono o laptop del DM: **Ajustes → Bestiario del DM → Elegir archivo**. Pesa unos 8 MB y queda guardado en ese dispositivo.

## Traducción en el teléfono

Chrome en Android y Safari no traen traductor integrado, así que en el teléfono traduce el servidor. Configúralo una vez en Render (*Environment*) con **una** de estas claves:

- `GEMINI_API_KEY` (de aistudio.google.com, **gratis y sin tarjeta**): traduce Gemini con los mismos términos de D&D y la conversión a metros. El plan gratis permite pocas traducciones por minuto; el servidor las hace de una en una y la caché evita repetirlas.
- `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` (Workers AI, **gratis y sin tarjeta**, 10 000 *neurons* al día): traduce con el modelo m2m100, párrafo por párrafo, con pies a metros y un glosario de D&D. Menos fino que Gemini o Claude, y en la versión traducida los enlaces se vuelven texto.
- `ANTHROPIC_API_KEY` (de console.anthropic.com): traduce Claude con los términos oficiales de D&D y convierte pies a metros. Se paga por uso con créditos prepagados.
- `DEEPL_API_KEY` (plan gratis de DeepL API, 500 000 caracteres al mes): buena traducción general, pero no conoce los términos de D&D ni convierte medidas.

Cada texto se traduce una sola vez y queda en caché para todo el grupo; además cada teléfono guarda lo que ya tradujo. `TR_DAILY_CHARS` (por defecto 400 000) pone un tope diario de caracteres nuevos.

## Estructura

```
web/                 La aplicación (sin framework)
  body.html          Marcado del libro, hojas y modo combate
  assets/icons.svg   Iconos propios (sin emojis)
  styles/*.css       Estilos, en orden de nombre
  src/lib.js         Biblioteca de 5etools: importar, resolver copias, indexar
  src/render.js      Texto de 5etools → HTML con enlaces
  src/rules.js       Motor de reglas: deriva el personaje (sin DOM)
  src/app.js         El diario: hoja, creador, grimorio, mochila, combate
  src/sala.js        Cliente de la sala de combate (WebSocket)
server/
  rooms.mjs          Lógica de las salas (probada sin red)
  index.mjs          HTTP (sirve web/dist) + WebSocket en /ws
tools/
  build-web.mjs      Junta todo en web/dist/index.html
  crear-paquete-diario.mjs  Crea diario-5e.json desde tu copia de 5etools
tests/               Pruebas del servidor (node:test) y de la web (jsdom)
docs/                Arquitectura, protocolo de la sala y pendientes
```

## Correrlo en tu laptop

```bash
npm install
npm run build
npm start            # http://localhost:8080
```

`npm run dev` recompila la web y reinicia el servidor cuando cambias algo en `server/`.

Abre `http://localhost:8080` (o `http://IP-de-tu-laptop:8080` desde el teléfono en la misma red). La sala se conecta sola al mismo servidor.

## Los datos de 5etools

El repo **no incluye** datos de 5etools. Cada quien crea su paquete desde su copia:

```bash
git clone --depth 1 https://github.com/5etools-mirror-3/5etools-src.git
npm run paquete -- ./5etools-src/data ./diario-5e.json
```

Luego en el diario: **Ajustes → Biblioteca de 5etools → Elegir archivo** y eliges `diario-5e.json`. Se guarda en el dispositivo (IndexedDB) y funciona sin internet.

## Pruebas

```bash
npm test                                   # servidor + web
DIARIO_PAQUETE=./diario-5e.json npm test   # si tu paquete está en otro lado
```

Las pruebas de la web necesitan un paquete; sin él se saltan y solo corren las del servidor (así pasa en GitHub Actions).

## Desplegar

**Opción recomendada: Render (gratis)**. Un solo servicio sirve la web y las salas.
1. En render.com: *New → Blueprint* y eliges este repo (usa `render.yaml`).
2. Abre la URL que te da Render (`https://diario-aventurero.onrender.com`). Listo: la sala ya apunta ahí.

El plan gratis se duerme tras 15 minutos sin uso; la primera conexión tarda unos segundos en despertar.

**Solo la web en GitHub Pages**: activa Pages con *GitHub Actions* como fuente. Para que haya salas, define la variable `SALA_URL` del repo con la dirección del servidor (`wss://…/ws`) o escríbela en *Ajustes → Salas de combate*.

**Como artefacto de claude.ai**: `npm run build:artifact` genera `web/dist/diario-artefacto.html`. Ahí funciona la traducción con Claude, pero las salas no (el artefacto no puede abrir conexiones a otros servidores).

## Licencia y contenido

El código es de este proyecto. Las reglas y textos de D&D pertenecen a Wizards of the Coast; el diario solo lee la copia de 5etools que cada usuario carga en su dispositivo.
