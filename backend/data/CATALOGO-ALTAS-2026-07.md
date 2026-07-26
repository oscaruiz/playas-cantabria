# Altas de playas — julio 2026 (25 playas físicas nuevas)

Documento de procedencia y estado de los datos incorporados a `beaches.json`
(backend) y su copia de fallback (`frontend/src/data/beaches.json`, idéntica byte a
byte — lo garantiza el test `beachCatalog.test.ts`).

## Modelo de datos (ampliaciones retrocompatibles)

- **`cruzRojaStations?: { id?: number; nombreFuente: string }[]`** — una playa física
  puede tener 0, 1 o varios puestos de Cruz Roja. `nombreFuente` es el nombre del
  puesto tal cual en Cruz Roja (alias operativo). `id` se OMITE cuando aún no está
  verificado. `idCruzRoja` (single) se conserva para las 21 playas legadas y para
  consumidores de una sola bandera; en playas multi-puesto se deriva del primer
  puesto con id conocido.
- **`alias?: string[]`** — topónimos/sectores/nombres alternativos para búsqueda y
  resolución de nombres. La búsqueda del frontend es *accent-insensitive* y cubre
  nombre + municipio + alias (`coincidePlaya` en `beachHelpers.ts`).
- **`sectores?: { nombre: string; longitud?: number }[]`** — sectores diferenciados
  (Somocuevas, Langre). Metadato: **no** se suman longitudes entre sectores.
- **`sinAemet: true` + código sintético** — ninguna de las 25 tiene ficha de
  previsión en AEMET (ver abajo). Se les asigna un código interno sintético
  `INE_municipio + 9x`, **verificado como 404 en AEMET** (no colisiona con ningún
  código real). El tiempo se sirve por coordenadas (OpenWeather), igual que Tagle.

### Regla de agregación de banderas (multi-puesto)

`domain/services/flagAggregation.ts` — determinista y **conservadora**: se muestra la
bandera **más restrictiva** entre los puestos con color izado
(`negra > roja > amarilla > verde`). Un puesto sin color **no** cuenta como verde ni
rebaja la bandera. Los estados individuales se conservan (el llamador los tiene).
Cubierto por `flagAggregation.test.ts` y `GetBeachDetailsFlags.test.ts`.

## Procedencia de los datos

- **Coordenadas** — TODAS verificadas de la ficha oficial de
  `turismodecantabria.com` (atributo `data-latitude`/`data-longitude` del marcador
  del mapa). Confianza: verificado.
- **Códigos AEMET** — investigación best-effort enumerando `INE + índice` contra el
  XML oficial de AEMET (`play_v2_{codigo}.xml`). Resultado: **AEMET solo publica
  ficha para las playas mayores**; ninguna de las 25 tiene código propio (AEMET
  agrupa Loredo bajo «Somo-Loredo» `3906102`, ya usado por Somo). → todas `sinAemet`
  con código sintético verificado libre.
- **IDs de Cruz Roja** — **VERIFICADOS (2026-07-23)** contra `listaPlayas.do` (los
  ids vienen en el `onclick="irFichaPlaya(ID)"` del HTML crudo; se leyó desde IP
  residencial). Las 25 nuevas tienen todos sus puestos con id real. La banderas ya
  se resuelven y agregan en vivo (probado: Trengandín → «Verde» agregada de sus 2
  puestos).

## Decisiones de modelado

- **Exclusiones/mapeos** (no se crean fichas nuevas): `LA CONCHA SANTANDER` no
  existe; `LA MACHINA` → alias de **San Martín**; `EL ROSAL` → alias de **El Sable de
  Merón**; `JOYEL`/`SUACES` → alias de **Ris**.
- **Consolidaciones a una sola playa**: Bikinis (BIKINIS + BIKINIS II), El Puntal
  (I+II), Loredo (I+II+III), Berria (3 puestos), Trengandín (2 puestos + alias
  BRUSCO/PASEO DEL BRUSCO), El Cabo / Gerra / Bederna (ficha oficial única «Playa de
  Gerra»).
- **Sectores**: Somocuevas (Occidental/Oriental, 310 m c/u — no sumados; punto =
  Occidental) y Langre (La Grande/La Pequeña — longitud a `null` por conflicto de
  fuentes). Coordenadas del segundo sector: Somocuevas Oriental `43.469689,
  -3.943678`; Langre La Pequeña `43.477199, -3.695247`.
- **Atributos**: solo se escriben los **verificados**; el resto se **omite** (nunca
  `false`). `accesible: false` solo donde la fuente describe una barrera objetiva
  explícita (escalera pronunciada / descenso desde acantilado): Mataleñas,
  Somocuevas, Langre, Los Locos, Covachos.
- **Mascotas** — **omitido** en El Puntal (solo zona canina junto al embarcadero) y
  Berria (solo franja horaria estival). Un booleano global sería engañoso y el modelo
  no tiene semántica zonal/estacional. Dato conocido pero no representable sin inducir
  a error.

## Corrección de dato pre-existente (con evidencia de Cruz Roja)

- **Mogro-Usil (Miengo)** tenía `idCruzRoja: 373`, pero **373 = `LA CONCHA I
  SUANCES`** en el listado oficial. Su puesto real es **`MOGRO = 376`**. Corregido
  → el duplicado 373 queda resuelto (0 warnings en el validador).
- **Cuchia-Marzan (Miengo)** no tenía id → añadido **`CUCHIA = 331`**.
- **Trengandín 2**: Cruz Roja lo escribe «CAMPO FUTBOL» (sin «DE»), id **1236**.

## Cobertura de Cruz Roja: 69 de 70 puestos de Cantabria mapeados

Se cruzaron TODAS las playas con el listado oficial (70 puestos). **69 quedan
asignados**; el único fuera es `LA CONCHA SANTANDER` (281), excluido por decisión.
Ocho playas existentes pasaron a **multi-puesto** con todos sus puestos (puesto
principal primero para conservar el `redCrossId` derivado):

- **La Salve** (Laredo): 328 + 808–814 (8 puestos)
- **Sardinero**: 278 (Castañeda/Segunda) + 280 (Primera) + 279 (Piquio)
- **Somo**: 369 + 816 + 817
- **Ris**: 1233 (Zona Muro) + 1234 (Zona Pineda) + 1232 (Joyel) + 1276 (Suaces)
- **La Concha** (Suances): 373 + 820
- **San Martín**: 1033 + 1034 (La Machina)
- **El Sable de Merón**: 1127 + 1118 (El Rosal)
- **Trengandín**: 1235 + 1236 + 1238 (Brusco) + 1277 (Paseo del Brusco)

`BRUSCO`/`PASEO DEL BRUSCO` (Noja) se asignan a Trengandín siguiendo la investigación
original (podrían discutirse como sectores de Helgueras). `flags.json` regenerado con
los 68 puestos accesibles (1 dio timeout puntual; el cron lo recoge).

## Campos que permanecen desconocidos / pendientes

- **La Ribera (Suances)** — solo `longitud` (350 m) verificada; sin tipo/arena/acceso
  (`datos_minimos`).
- **Langre** — `longitud` sin valor (conflicto de fuentes: dos fichas asignan 1.200 m).
- Anchura, parking, bus, distancia a hospital, submarinismo, webcams: no verificados
  en la mayoría → omitidos.

## flags.json

`data/flags.json` (banderas pre-scrapeadas que sirve prod, donde el scrape en vivo
da 403) aún NO contiene los ids nuevos: se rellenará en la próxima ejecución de
`npm run scrape:flags` desde IP residencial (el script ya recoge los ids de
`cruzRojaStations`). En local el scrape en vivo funciona y las banderas se resuelven.
