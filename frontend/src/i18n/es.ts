/**
 * Diccionario base en español. Es la fuente de verdad de las claves:
 * `ClaveTexto` se infiere de aquí y en.ts debe cubrirlas todas (lo
 * garantiza el compilador vía `satisfies`).
 *
 * Interpolación: los huecos se escriben como {nombre} y se rellenan
 * con el segundo argumento de t(). Las claves con sufijo _one/_other
 * son formas plurales y se resuelven con tPlural().
 */
export const es = {
  // ---- App / global ----
  'app.titulo': 'Playas de Cantabria',
  'app.tituloDocumento': 'Playas Cantabria',

  // ---- Navegación inferior ----
  'nav.principal': 'Navegación principal',
  'nav.inicio': 'Inicio',
  'nav.playas': 'Playas',
  'nav.mapa': 'Mapa',

  // ---- Selector de idioma ----
  'selector.idioma': 'Idioma',

  // ---- Comunes ----
  'comun.verDetalleDe': 'Ver detalle de {nombre}',
  'comun.aKm': 'a {km} km',
  'comun.noDisponible': 'No disponible',
  'comun.cruzRoja': 'Cruz Roja',

  // ---- Tiempo relativo ----
  'tiempo.ahoraMismo': 'ahora mismo',
  'tiempo.haceMin': 'hace {n} min',
  'tiempo.haceHoras': 'hace {n}h',

  // ---- Home ----
  'home.subtitulo': 'Descubre las mejores playas de Cantabria',
  'home.mediaTemp': '{temp}° media',
  'home.playasBadge_one': '{count} playa',
  'home.playasBadge_other': '{count} playas',
  'home.buscando': 'Buscando las mejores playas cerca de ti...',
  'home.locBloqueadaTitulo': 'Localización bloqueada',
  'home.locBloqueadaSub': 'Para activarla, ve a los ajustes de tu navegador',
  'home.locNoDisponibleTitulo': 'Localización no disponible',
  'home.locNoDisponibleSub': 'Toca para activar y ver playas cerca de ti',
  'home.cercaDeTi': 'Playas más cerca de ti',
  'home.recomendadas': 'Playas recomendadas',
  'home.sinDestacadas': 'Hoy no hay playas destacadas — consulta el listado completo',
  'home.errorCondiciones': 'No se pudieron cargar las condiciones actuales',
  'home.reintentar': 'Reintentar',
  'home.revisarAntes': 'Mejor revisar antes de ir',
  'home.verTodas': 'Ver todas las playas',
  'home.playasDisponibles_one': '{count} playa disponible',
  'home.playasDisponibles_other': '{count} playas disponibles',
  'home.explorarMapa': 'Explorar en el mapa',
  'home.localizaCerca': 'Localiza playas cerca de ti',
  'home.banderaAria': 'Bandera {bandera}',

  // ---- Lista de playas ----
  'lista.subtitulo': 'Consulta el estado de las playas',
  'lista.placeholder': 'Buscar playa o municipio...',
  'lista.buscarAria': 'Buscar playa o municipio',
  'lista.borrarBusqueda': 'Borrar búsqueda',
  'lista.ordenarCercania': 'Ordenar por cercanía',
  'lista.ordenarAZ': 'Ordenar A-Z',
  'lista.cargando': 'Cargando playas...',
  'lista.contador_one': '{count} playa',
  'lista.contador_other': '{count} playas',
  'lista.paraFiltro': 'para "{filtro}"',
  'lista.noEncontradas': 'No se encontraron playas para "{filtro}"',
  'lista.vigiladaAria': 'Playa vigilada por Cruz Roja',
  'lista.errorCarga': 'No se pudieron cargar las playas',

  // ---- Mapa ----
  'mapa.subtitulo': 'Explora las playas en el mapa',
  'mapa.municipio': 'Municipio:',
  'mapa.vigilada': 'Vigilada por Cruz Roja',
  'mapa.sinInfoCruzRoja': 'No hay info de Cruz Roja',
  'mapa.verDetalles': 'Ver detalles',
  'mapa.tuUbicacion': 'Tu ubicación actual',
  'mapa.banderaRoja': 'Bandera roja',
  'mapa.vientoFuerteKmh': 'Viento fuerte ({kmh} km/h)',

  // ---- Niveles de viento (derivados de vientoMs) ----
  'viento.sinViento': 'sin viento',
  'viento.brisaSuave': 'brisa suave',
  'viento.moderado': 'viento moderado',
  'viento.fuerte': 'viento fuerte',

  // ---- Bandera (Cruz Roja) ----
  'bandera.roja': 'Bandera Roja',
  'bandera.amarilla': 'Bandera Amarilla',
  'bandera.verde': 'Bandera Verde',
  'bandera.sinDatos': 'Sin datos',
  'bandera.fueraDeHorario': 'Fuera de horario',

  // ---- Fechas relativas ----
  'fecha.hoy': 'Hoy',
  'fecha.manana': 'Mañana',
  'fecha.pasadoManana': 'Pasado mañana',

  // ---- Detalle de playa ----
  'detalle.titulo': 'Detalle',
  'detalle.volver': 'Volver',
  'detalle.cargando': 'Cargando datos de la playa...',
  'detalle.errorCarga': 'No se pudo cargar el detalle de la playa',
  'detalle.comoLlegar': 'Cómo llegar',
  'detalle.verEnMapa': 'Ver en el mapa',
  'detalle.estadoBano': 'Estado para bañarse (según Cruz Roja)',
  'detalle.banderaAria': 'bandera',
  'detalle.vigilancia': 'Vigilancia: {horario}',
  'detalle.temp': 'Temp.',
  'detalle.temperatura': 'Temperatura',
  'detalle.agua': 'Agua',
  'detalle.viento': 'Viento',
  'detalle.oleaje': 'Oleaje',
  'detalle.cielo': 'Cielo',
  'detalle.sensacion': 'Sensación',
  'detalle.indiceUV': 'Indice UV',
  'detalle.max': 'Máx.',
  'detalle.aguaGrados': 'Agua {temp}°C',
  'detalle.periodoManana': 'Mañana',
  'detalle.periodoTarde': 'Tarde',
  'detalle.sensacionTermica': 'Sensación térmica',
  'detalle.avisoLitoral': 'Aviso litoral',
  'detalle.mareas': 'Mareas',
  'detalle.expandir': 'Expandir',
  'detalle.contraer': 'Contraer',
  'detalle.previsionAemet': 'Previsión meteorológica AEMET',
  'detalle.infoPlaya': 'Información de la playa',
  'detalle.dimensiones': 'Dimensiones',
  'detalle.tipo': 'Tipo',
  'detalle.arena': 'Arena',
  'detalle.acceso': 'Acceso',
  'detalle.parking': 'Parking',
  'detalle.bus': 'Bus',
  'detalle.hospital': 'Hospital',
  'detalle.servicios': 'Servicios y características',
  'detalle.zonaAvisos': 'Zona de avisos: {zona}',
  'detalle.datosMeteo': 'Datos meteorológicos: {fuente}',

  // ---- Mareas ----
  'marea.subiendo': 'Subiendo',
  'marea.bajando': 'Bajando',
  'marea.pleamar': 'Pleamar',
  'marea.bajamar': 'Bajamar',

  // ---- Cruz Roja (tarjeta) ----
  'cruzroja.vigilanciaCobertura': 'Vigilancia y cobertura',
  'cruzroja.sinInfo': 'Información de Cruz Roja aún no disponible',
  'cruzroja.banderaActual': 'Bandera actual',
  'cruzroja.coberturaDesde': 'Cobertura desde',
  'cruzroja.coberturaHasta': 'Cobertura hasta',
  'cruzroja.horario': 'Horario',

  // ---- Atributos de playa (claves alineadas con ATTR_CONFIG) ----
  'attr.duchas': 'Duchas',
  'attr.aseos': 'Aseos',
  'attr.parking': 'Parking',
  'attr.accesible': 'Accesible',
  'attr.chiringuito': 'Chiringuito',
  'attr.surf': 'Surf',
  'attr.mascotas': 'Mascotas',
  'attr.socorrismo': 'Socorrismo',
  'attr.nudista': 'Nudista',
  'attr.accesoBanista': 'Acceso baño',
  'attr.submarinismo': 'Submarinismo',
} as const;

export type ClaveTexto = keyof typeof es;

/** Bases válidas para tPlural(): deben existir `${base}_one` y `${base}_other`. */
export type BasePlural = 'lista.contador' | 'home.playasBadge' | 'home.playasDisponibles';
