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
| `npc.reveal` | `id` | DM | Muestra u oculta un PNJ a los jugadores. |
| `hidepc` | `value` | DM | Oculta los PG exactos del grupo entre jugadores. |
| `turn` | `dir`: `start` \| `next` \| `prev` | DM / quien tiene el turno | Avanza el turno; al dar la vuelta sube la ronda. |
| `end` | — | DM | Termina el combate y borra la iniciativa. |
| `apply` | `targets[]`, `kind`, `amount?`, `cond?`, `note?` | cualquiera | `kind`: `damage`, `heal`, `temp`, `cond+`, `cond-`. |
| `leave` | — | cualquiera | Sale de la sala. |

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

12 personas y 40 PNJ por sala, 500 salas por servidor, mensajes de hasta 16 KB, 30 mensajes cada 5 segundos por conexión.
