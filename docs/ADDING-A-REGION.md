# Añadir una región

Una región es **un directorio de datos**, no código. Todo lo que necesitas está en
`regions/<id>/`, y el motor —backend y frontend— no cambia.

El cuello de botella real no es técnico: es **compilar el catálogo de playas**. El resto es
media hora.

## 1. Genera el esqueleto

```bash
cd backend
npm run region:new -- --id asturias --name Asturias
```

Crea `regions/asturias/` con un `region.json` de partida y un `beaches.json` vacío. El
esqueleto **no valida a propósito**: los bboxes vienen a 0 para que tengas que mirarlos.

## 2. Rellena `region.json`

| Campo | Qué es | Cómo elegirlo |
|---|---|---|
| `observationBbox` | Recorte de las observaciones de AEMET | **Ancho**: decenas de km de margen sobre la costa. AEMET publica toda España y esto selecciona qué estaciones pueden servir a tus playas. Si lo aprietas, las playas se quedan sin observación. |
| `catalogRules.bbox` | Comprobación de integridad del catálogo | **Ajustado** a la costa real. Sirve para cazar una coordenada mal tecleada. |
| `catalogRules.forbiddenBeaches` | Entradas que no deben existir | Para duplicados conocidos o nombres que la fuente confunde. Ver «Patrones» abajo. |
| `flagProviders` | Operadores de banderas activos | `[]` es **una configuración soportada, no degradada**. Ver punto 4. |
| `branding` | Identidad de la app | `capacitorAppId` debe ser tuyo: `com.example.<id>` es un marcador y no puede ir a la Store. |
| `map` | Vista inicial del mapa | Centro y zoom. |

## 3. Compila el catálogo (`beaches.json`)

Un array de objetos. Lo mínimo por playa:

```jsonc
{
  "nombre": "San Lorenzo",
  "municipio": "Gijón",
  "codigo": "3302401",   // código de playa de AEMET
  "lat": 43.542,
  "lon": -5.655
}
```

**El `codigo` de AEMET** es la clave primaria de todas sus APIs. Se saca de la URL de la
predicción de esa playa en `aemet.es` (`.../playas?l=3302401`). Para una playa **sin ficha
en AEMET**, inventa un código que no colisione y marca `"sinAemet": true`: el motor se salta
las llamadas que darían 404 en vez de gastarlas.

Campos opcionales que enriquecen la ficha: `alias` (topónimos para la búsqueda), `sectores`,
`atributos` (duchas, parking, surf…), `longitud`, `anchura`, `webcam`.

## 4. Banderas: declara solo lo que exista

Si tu región tiene servicio de socorrismo con banderas publicadas:

1. Declara el operador en `flagProviders` (hoy solo existe `cruzroja`).
2. Añade a cada playa su referencia (`idCruzRoja`, o `cruzRojaStations` si tiene varios
   puestos). La convención es que **`0` o ausente significa «sin cobertura»**.

Si no lo tiene, deja `flagProviders: []`. La app entonces **dice que no hay servicio** en vez
de fingir que no hay datos, y saca el factor bandera del cálculo de puntuación para no
penalizar a toda la región por algo que no depende de las playas.

Si tu operador no es Cruz Roja, hace falta un adaptador — eso sí es código, y está
documentado en `backend/CLAUDE.md` («Adding a flag operator»). Abre un issue antes de
empezarlo.

## 5. Comprueba antes de abrir el PR

```bash
cd backend
npm run validate:regions   # esquema, catálogo, coordenadas, coherencia de operadores
npm run quota:budget       # ¿cabe en las cuotas gratuitas junto al resto?

cd ../frontend
npm run check-regions      # datos + configuración de hosting
REACT_APP_REGION=asturias npm run build   # ¿se construye tu app?
```

### Qué valida el CI

- **Esquema** de `region.json` (Zod) e id que coincide con el directorio.
- **Catálogo**: coordenadas dentro del bbox, sin códigos duplicados, sin playas prohibidas,
  sin ids de operador compartidos entre playas.
- **Coherencia de banderas**: una playa no puede referenciar un operador que la región no
  declara. Si lo hace, el router no tiene adaptador y esa playa no mostraría bandera nunca —
  indistinguible de una playa sin vigilancia.
- **Presupuesto de cuota**: estima peticiones salientes/día de todas las regiones juntas y
  las compara con los límites gratuitos. **Comenta la tabla en el PR** y falla si no cabe.
  Las cuotas son compartidas: una región que no cabe no se degrada a sí misma, degrada a
  todas.
- **Build** de tu región en un job aislado, con presupuesto de tamaño de bundle.

Una región inválida **no tumba a las demás**: el registro la descarta con un error en el log
y el resto sigue sirviendo. Pero el CI sí falla, para que no se te cuele.

## 6. Lo que solo puede hacer quien mantiene el repo

Dos cosas necesitan permisos que un PR no tiene, así que **no bloquean tu contribución** (el
CI solo avisa):

- El **sitio de Firebase Hosting** de tu región y su target en `.firebaserc` / `firebase.json`.
- El **cron de banderas**, que se activa solo si declaras un operador.

Ábrelo como parte del PR y se configuran al mezclarlo.

## Patrones de `forbiddenBeaches`

`nombrePattern` se compila como expresión regular y se ejecuta contra los nombres del
catálogo — es el único sitio donde tus datos se vuelven ejecutables. Por eso el esquema
**prohíbe la repetición** (`*`, `+`, `{n,m}`) y las retro-referencias: un patrón como
`(a+)+$` cabe en seis caracteres y su coste crece de forma explosiva, y colgaría la
validación de todo el mundo.

Lo que sí puedes usar: literales, anclas (`^`, `$`), grupos, alternancia (`|`) y unos pocos
opcionales (`?`). Con eso se expresa cualquier variante razonable de un nombre:

```jsonc
{ "municipio": "santander", "nombrePattern": "^(la )?concha( de santander)?$" }
```
