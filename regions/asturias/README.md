# Asturias — notas de la región

Catálogo inicial de **14 playas**, todas con servicio de socorrismo, escogidas por afluencia y
repartidas por la costa (Castropol a Ribadedeva).

Los 13 códigos de AEMET están **verificados uno a uno** contra
`https://www.aemet.es/xml/playas/play_v2_<codigo>.xml`: el nombre que devuelve la ficha coincide
con el del catálogo. Verdicio no tiene ficha en AEMET (barriendo los índices de Gozón solo
aparece `3302509 → Santa Marina de Luanco`), por eso lleva código sintético `3302590` y
`sinAemet: true`.

## Por qué `flagProviders: []`

Asturias **sí tiene** un servicio de banderas consultable, pero todavía no hay adaptador. Hasta
que lo haya, declarar el operador sería mentir: el router no tendría con qué resolver la
referencia y las playas saldrían sin bandera, indistinguibles de una playa sin vigilancia. Con el
array vacío la app dice honestamente que aquí no hay servicio, y el factor bandera sale del
cálculo de puntuación en vez de penalizar a toda la región.

## Lo que hace falta para añadir las banderas

**Fuente principal** — SEPA / 112 Asturias: `https://www.112asturias.es/estado-playas`
Comprobado: responde 200, filtra por bandera (verde/amarilla/roja) y **los nombres de playa vienen
en el HTML del servidor**, así que es raspable con Cheerio igual que Cruz Roja. El identificador
es el **nombre textual del puesto**, no un id numérico.

**Excepción** — Gijón publica San Lorenzo por su cuenta:
`https://www.gijon.es/es/directorio/vigilancia-y-salvamento-de-playas`

Nombres de puesto observados, por playa:

| Playa | Puesto publicado |
|---|---|
| Peñarronda | PEÑARRONDA |
| Anguileiro | LOS CAMPOS (Anguileiro) |
| Primera y Segunda de Luarca | LUARCA/SALINAS |
| Salinas - San Juan, El Espartal | SALINAS, ESPARTAL, SAN JUAN DE NIEVA *(tres estados para una ficha AEMET)* |
| Candás - La Palmera | PALMERA |
| Verdicio | VERDICIO |
| San Lorenzo | *(Ayuntamiento de Gijón, no en la tabla autonómica)* |
| Rodiles | RODILES |
| Vega | VEGA |
| Santa Marina | STA. MARINA |
| Niembro | TORANDA |
| Palombina - Las Cámaras, Los Frailes | PALOMBINA *(sin verificar que cubra los tres arenales)* |
| Toró | TORÓ |
| La Franca | LA FRANCA |

**Dos huecos de diseño que hay que cerrar antes**, y que no son de esta región sino del motor:

1. El catálogo no tiene campo neutral para un operador que no sea Cruz Roja.
   `JsonBeachRepository` solo deriva referencias de `idCruzRoja` / `cruzRojaStations`. Hace falta
   algo del estilo `flagRefs: [{ provider, ref }]`.
2. `FlagRef.ref` es `number`, heredado de los ids de Cruz Roja. El SEPA publica nombres, así que
   el tipo tiene que admitir texto.

## Pendiente de dato

- `capacitorAppId` real (`com.example.asturias` es un marcador; no se van a publicar apps por ahora).
- Longitud y anchura de los arenales, salvo Verdicio (330 m).
- Tipo de playa, arena, accesos, y el resto de `atributos`: **omitidos a propósito**. Omitir
  significa «no lo sé»; ponerlos a `false` afirmaría que la playa no los tiene.
- Si la bandera de PALOMBINA cubre también Las Cámaras y Los Frailes.
