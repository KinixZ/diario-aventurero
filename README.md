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
- **Mochila tipo Resident Evil 4** con contenedores (mochila, Bag of Holding, sacos, carcajes…), equipo por ranura y armas homebrew.
- **Compañeros**: homúnculo, defensor de acero, familiares e invocaciones con sus números calculados.
- **Traducción automática** de textos (traductor del navegador o Claude cuando corre como artefacto).
- **Sala de combate**: código de 4 letras, iniciativa ordenada, turnos y rondas, PNJ del DM (ocultos o visibles), daño, curación, PG temporales y condiciones aplicadas de un jugador a otro.

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
