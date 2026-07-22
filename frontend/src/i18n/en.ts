import type { ClaveTexto } from './es';

/**
 * Diccionario en inglés. `satisfies` obliga a cubrir exactamente las
 * mismas claves que es.ts: una clave de menos o de más es error de
 * compilación.
 */
export const en = {
  // ---- App / global ----
  'app.titulo': 'Cantabria Beaches',
  'app.tituloDocumento': 'Cantabria Beaches',

  // ---- Navegación inferior ----
  'nav.principal': 'Main navigation',
  'nav.inicio': 'Home',
  'nav.playas': 'Beaches',
  'nav.mapa': 'Map',

  // ---- Selector de idioma ----
  'selector.idioma': 'Language',

  // ---- Comunes ----
  'comun.verDetalleDe': 'View details for {nombre}',
  'comun.aKm': '{km} km away',
  'comun.noDisponible': 'Not available',
  'comun.cruzRoja': 'Red Cross',

  // ---- Tiempo relativo ----
  'tiempo.ahoraMismo': 'updated just now',
  'tiempo.haceMin': 'updated {n} min ago',
  'tiempo.haceHoras': 'updated {n}h ago',
  'tiempo.haceDias': 'updated {n}d ago',

  // ---- Home ----
  'home.subtitulo': 'Discover the best beaches in Cantabria',
  'home.mediaTemp': '{temp}° average',
  'home.playasBadge_one': '{count} beach',
  'home.playasBadge_other': '{count} beaches',
  'home.buscando': 'Finding the best beaches near you...',
  'home.locBloqueadaTitulo': 'Location blocked',
  'home.locBloqueadaSub': 'To enable it, go to your browser settings',
  'home.locNoDisponibleTitulo': 'Location not available',
  'home.locNoDisponibleSub': 'Tap to enable and see beaches near you',
  'home.cercaDeTi': 'Beaches closest to you',
  'home.mejorHoy': "Today's best beach",
  'home.mejorParaTi': 'Best for you today',
  'home.notaCercania': 'Prioritized by distance: some beaches score higher but are farther away',
  'home.mejorPuntuacion': 'Top score',
  'home.alternativas': 'Other good options',
  'home.verDetalles': 'View details',
  'home.verEnMapa': 'View on the map',
  'home.verEnMapaDe': 'View {nombre} on the map',
  'home.puntuacionAria': 'Score {n} out of 100',
  'home.sinDestacadas': 'No featured beaches today — check the full list',
  'home.errorCondiciones': 'Could not load current conditions',
  'home.reintentar': 'Retry',
  'home.revisarAntes': 'Better check before you go',
  'home.banderaAria': '{bandera} flag',

  // ---- Lista de playas ----
  'lista.subtitulo': 'Check beach conditions',
  'lista.placeholder': 'Search beach or municipality...',
  'lista.buscarAria': 'Search beach or municipality',
  'lista.borrarBusqueda': 'Clear search',
  'lista.ordenarCercania': 'Sort by distance',
  'lista.ordenarAZ': 'Sort A-Z',
  'lista.cargando': 'Loading beaches...',
  'lista.contador_one': '{count} beach',
  'lista.contador_other': '{count} beaches',
  'lista.paraFiltro': 'for "{filtro}"',
  'lista.noEncontradas': 'No beaches found for "{filtro}"',
  'lista.vigiladaAria': 'Beach supervised by the Red Cross',
  'lista.webcamAria': 'Beach with webcam available',
  'lista.errorCarga': 'Could not load beaches',

  // ---- Mapa ----
  'mapa.subtitulo': 'Explore the beaches on the map',
  'mapa.municipio': 'Municipality:',
  'mapa.vigilada': 'Supervised by the Red Cross',
  'mapa.sinInfoCruzRoja': 'No Red Cross info',
  'mapa.webcamDisponible': 'Webcam available',
  'mapa.verDetalles': 'View details',
  'mapa.tuUbicacion': 'Your current location',
  'mapa.banderaRoja': 'Red flag',
  'mapa.vientoFuerteKmh': 'Strong wind ({kmh} km/h)',
  'mapa.leyendaBuenas': 'Good conditions',
  'mapa.leyendaRegular': 'Use caution',
  'mapa.leyendaMalas': 'Not advised',
  'mapa.leyendaBandera': 'Red Cross flag hoisted',

  // ---- Niveles de viento ----
  'viento.sinViento': 'no wind',
  'viento.brisaSuave': 'gentle breeze',
  'viento.moderado': 'moderate wind',
  'viento.fuerte': 'strong wind',

  // ---- Bandera (Cruz Roja) ----
  'bandera.roja': 'Red Flag',
  'bandera.amarilla': 'Yellow Flag',
  'bandera.verde': 'Green Flag',
  'bandera.sinDatos': 'No data',
  'bandera.fueraDeHorario': 'Outside hours',

  // ---- Fechas relativas ----
  'fecha.hoy': 'Today',
  'fecha.manana': 'Tomorrow',
  'fecha.pasadoManana': 'Day after tomorrow',

  // ---- Detalle de playa ----
  'detalle.titulo': 'Detail',
  'detalle.volver': 'Back',
  'detalle.cargando': 'Loading beach data...',
  'detalle.errorCarga': 'Could not load beach details',
  'detalle.comoLlegar': 'Directions',
  'detalle.verEnMapa': 'View on the map',
  'detalle.estadoBano': 'Swimming conditions (per Red Cross)',
  'detalle.banderaAria': 'flag',
  'detalle.vigilancia': 'Lifeguard hours: {horario}',
  'detalle.temperatura': 'Temperature',
  'detalle.agua': 'Water',
  'detalle.viento': 'Wind',
  'detalle.oleaje': 'Waves',
  'detalle.cielo': 'Sky',
  'detalle.sensacion': 'Feels like',
  'detalle.indiceUV': 'UV index',
  'detalle.max': 'Max.',
  'detalle.aguaGrados': 'Water {temp}°C',
  'detalle.lloviendoAhora': 'Raining now',
  'detalle.lluviaUltimaHora': 'Rain in the last hour',
  'detalle.lluviaPrevistaHora': 'Rain expected around {hora}',
  'detalle.lluviaPrevistaHoy': 'Rain expected today',
  'detalle.previsionAemet': 'Forecast (AEMET)',
  'detalle.periodoManana': 'Morning',
  'detalle.periodoTarde': 'Afternoon',
  'detalle.sensacionTermica': 'Feels like',
  'detalle.avisoLitoral': 'Coastal warning',
  'detalle.mareas': 'Tides',
  'detalle.expandir': 'Expand',
  'detalle.contraer': 'Collapse',
  'detalle.infoPlaya': 'Beach information',
  'detalle.dimensiones': 'Dimensions',
  'detalle.tipo': 'Type',
  'detalle.arena': 'Sand',
  'detalle.acceso': 'Access',
  'detalle.parking': 'Parking',
  'detalle.bus': 'Bus',
  'detalle.hospital': 'Hospital',
  'detalle.servicios': 'Services and features',
  'detalle.zonaAvisos': 'Warning zone: {zona}',
  'detalle.datosMeteo': 'Weather data: {fuente}',

  // ---- Mareas ----
  'marea.subiendo': 'Rising',
  'marea.bajando': 'Falling',
  'marea.pleamar': 'High tide',
  'marea.bajamar': 'Low tide',

  // ---- Cruz Roja (tarjeta) ----
  'cruzroja.vigilanciaCobertura': 'Lifeguard service and coverage',
  'cruzroja.sinInfo': 'Red Cross information not available yet',
  'cruzroja.banderaActual': 'Current flag',
  'cruzroja.coberturaDesde': 'Coverage from',
  'cruzroja.coberturaHasta': 'Coverage until',
  'cruzroja.horario': 'Hours',
  'cruzroja.ultimaActualizacion': 'Last updated',

  // ---- Webcam (detail card) ----
  'webcam.enDirecto': 'Live webcam',
  'webcam.vistaPanoramica': 'Panoramic view of the area',
  'webcam.cercana': 'Nearby webcam',
  'webcam.abrir': 'Open webcam',

  // ---- Atributos de playa ----
  'attr.duchas': 'Showers',
  'attr.aseos': 'Toilets',
  'attr.parking': 'Parking',
  'attr.accesible': 'Accessible',
  'attr.chiringuito': 'Beach bar',
  'attr.surf': 'Surf',
  'attr.mascotas': 'Pets allowed',
  'attr.socorrismo': 'Lifeguards',
  'attr.nudista': 'Nudist',
  'attr.accesoBanista': 'Swimmer access',
  'attr.submarinismo': 'Scuba diving',
} satisfies Record<ClaveTexto, string>;
