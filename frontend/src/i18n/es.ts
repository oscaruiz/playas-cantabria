/**
 * Base dictionary in Spanish. It is the source of truth for the keys:
 * `ClaveTexto` is inferred from here and en.ts must cover them all (the
 * compiler guarantees it via `satisfies`).
 *
 * Interpolation: placeholders are written as {nombre} and are filled
 * with the second argument of t(). Keys with the _one/_other suffix
 * are plural forms and are resolved with tPlural().
 */
export const es = {
  // ---- App / global ----
  'app.titulo': 'Playas de {region}',
  'app.tituloDocumento': 'Playas {region}',

  // ---- Bottom navigation ----
  'nav.principal': 'Navegación principal',
  'nav.inicio': 'Inicio',
  'nav.playas': 'Playas',
  'nav.mapa': 'Mapa',

  // ---- Language selector ----
  'selector.idioma': 'Idioma',

  // ---- Common ----
  'comun.verDetalleDe': 'Ver detalle de {nombre}',
  'comun.aKm': 'a {km} km',
  'comun.noDisponible': 'No disponible',

  // ---- Relative time ----
  'tiempo.ahoraMismo': 'actualizado ahora mismo',
  'tiempo.haceMin': 'actualizado hace {n} min',
  'tiempo.haceHoras': 'actualizado hace {n}h',
  'tiempo.haceDias': 'actualizado hace {n} d',

  // ---- Favorites ----
  'fav.marcar': 'Guardar {nombre} en favoritas',
  'fav.quitar': 'Quitar {nombre} de favoritas',
  'fav.filtro': 'Mostrar solo favoritas',
  'fav.vacio': 'Aún no tienes playas favoritas. Toca la estrella de una playa para guardarla aquí.',

  // ---- Home ----
  'home.subtitulo': 'Descubre las mejores playas de {region}',
  'home.mediaTemp': '{temp}° media',
  'home.playasBadge_one': '{count} playa',
  'home.playasBadge_other': '{count} playas',
  'home.buscando': 'Buscando las mejores playas cerca de ti...',
  'home.locBloqueadaTitulo': 'Localización bloqueada',
  'home.locBloqueadaSub': 'Para activarla, ve a los ajustes de tu navegador',
  'home.locNoDisponibleTitulo': 'Localización no disponible',
  'home.locNoDisponibleSub': 'Toca para activar y ver playas cerca de ti',
  'home.cercaDeTi': 'Playas más cerca de ti',
  'home.mejorHoy': 'La mejor playa para hoy',
  'home.mejorParaTi': 'La mejor para ti hoy',
  'home.notaCercania': 'Priorizada por cercanía: hay playas con más puntos, pero más lejos',
  'home.mejorPuntuacion': 'Mejor puntuación',
  'home.alternativas': 'Otras buenas opciones',
  'home.verDetalles': 'Ver detalles',
  'home.verEnMapa': 'Ver en el mapa',
  'home.verEnMapaDe': 'Ver {nombre} en el mapa',
  'home.puntuacionAria': 'Puntuación {n} de 100',
  'home.sinDestacadas': 'Hoy no hay playas destacadas — consulta el listado completo',
  'home.errorCondiciones': 'No se pudieron cargar las condiciones actuales',
  'home.reintentar': 'Reintentar',
  'home.revisarAntes': 'Mejor revisar antes de ir',
  'home.banderaAria': 'Bandera {bandera}',

  // ---- Beach list ----
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
  'lista.vigiladaAria': 'Playa vigilada por {operador}',
  'lista.webcamAria': 'Playa con webcam disponible',
  'lista.datosLocales': 'Sin conexión: mostrando datos guardados, puede que estén desactualizados',
  'lista.datosNoDisponibles': 'No se pudieron cargar las playas ni los datos guardados',

  // ---- Map ----
  'mapa.subtitulo': 'Explora las playas en el mapa',
  'mapa.municipio': 'Municipio:',
  'mapa.vigilada': 'Vigilada por {operador}',
  'mapa.sinInfoCruzRoja': 'No hay info de vigilancia',
  'mapa.sinVigilancia': 'Sin servicio de vigilancia',
  'mapa.webcamDisponible': 'Webcam disponible',
  'mapa.verDetalles': 'Ver detalles',
  'mapa.tuUbicacion': 'Tu ubicación actual',
  'mapa.localizarme': 'Localizarme',
  'mapa.banderaRoja': 'Bandera roja',
  'mapa.vientoFuerteKmh': 'Viento fuerte ({kmh} km/h)',
  'mapa.leyendaBuenas': 'Buenas condiciones',
  'mapa.leyendaRegular': 'Con precaución',
  'mapa.leyendaMalas': 'Desaconsejada',
  'mapa.leyendaBandera': 'Bandera izada',

  // ---- Wind levels (derived from vientoMs) ----
  'viento.sinViento': 'sin viento',
  'viento.brisaSuave': 'brisa suave',
  'viento.moderado': 'viento moderado',
  'viento.fuerte': 'viento fuerte',

  // ---- Flag (Cruz Roja) ----
  'bandera.negra': 'Bandera Negra',
  'bandera.roja': 'Bandera Roja',
  'bandera.amarilla': 'Bandera Amarilla',
  'bandera.verde': 'Bandera Verde',
  'bandera.sinDatos': 'Sin datos',
  'bandera.fueraDeHorario': 'Fuera de horario',
  'bandera.ultimaRegistrada': 'Última bandera registrada: {bandera}',

  // ---- Relative dates ----
  'fecha.hoy': 'Hoy',
  'fecha.manana': 'Mañana',
  'fecha.pasadoManana': 'Pasado mañana',

  // ---- Beach detail ----
  'detalle.titulo': 'Detalle',
  'detalle.volver': 'Volver',
  'detalle.puntuacion': 'Puntuación de hoy',
  'detalle.comoSeCalcula': 'Cómo se calcula',
  'detalle.scoreInfo.intro': 'La puntuación (0–100) resume lo apetecible y segura que está la playa hoy. Combina las condiciones del momento, dando más peso a lo que más marca un buen día de playa:',
  'detalle.scoreInfo.sol': 'Sol y cielo: cuanto más despejado, mejor.',
  'detalle.scoreInfo.temp': 'Temperatura: sube con tiempo agradable y baja con frío.',
  'detalle.scoreInfo.bandera': 'Bandera de vigilancia: verde suma, amarilla resta y roja o negra hunden la nota.',
  'detalle.scoreInfo.viento': 'Viento: cuanto más flojo, mejor.',
  'detalle.scoreInfo.oleaje': 'Oleaje: el mar tranquilo puntúa más (en playas de surf no penaliza).',
  'detalle.scoreInfo.datos': 'Datos disponibles: sube cuando hay clima y bandera de hoy.',
  'detalle.scoreInfo.lluvia': 'Lluvia: si llueve o se espera, la nota se limita para que nunca salga como "buen día".',
  'detalle.scoreInfo.peligro': 'Peligro: con bandera negra, tormenta o aviso, la playa se marca para evitarla.',
  'detalle.scoreInfo.cierre': 'Es una orientación rápida, no una medición exacta.',
  // Desglose real de ESTA playa: el panel explicaba el modelo en abstracto y no
  // respondía la única pregunta de quien lo abre ("¿por qué esta playa tiene 59?").
  'detalle.scoreInfo.deEstaPlaya': 'Hoy, en esta playa:',
  'detalle.scoreInfo.puntos': '{n}/{max}',
  'detalle.scoreInfo.datosCompletos': 'clima y bandera',
  'detalle.scoreInfo.datosParciales': 'faltan datos',
  'detalle.scoreInfo.sinDato': 'sin dato',
  'detalle.scoreInfo.sinBanderaAhora': 'sin bandera ahora',
  'detalle.scoreInfo.topeLluvia': 'Está lloviendo: la nota se limita a {n} por muy bien que puntúe el resto.',
  'detalle.scoreInfo.topeLluviaPrevista': 'Se espera lluvia: la nota se limita a {n} por muy bien que puntúe el resto.',
  // Previsión de las próximas horas (el ajuste que mueve la nota hasta ±8).
  'detalle.pronostico.titulo': 'Próximas 4 h',
  'detalle.pronostico.mejora': 'Está mejorando',
  'detalle.pronostico.empeora': 'Está empeorando',
  'detalle.pronostico.estable': 'Sin cambios',
  'detalle.pronostico.puntos': '{n} puntos',
  'detalle.pronostico.sinDatos': 'Sin previsión horaria ahora mismo.',
  'detalle.pronostico.ariaHora': 'A las {hora}: {nubes}% de nubes, {temp} grados, viento {viento} metros por segundo',
  // Por QUÉ se mueve. "Mejora" a secas no sirve para decidir: lo que decide es
  // que se abre el cielo o que se levanta viento.
  'detalle.pronostico.causa.despeja': 'se despeja',
  'detalle.pronostico.causa.nubla': 'se nubla',
  'detalle.pronostico.causa.subeTemperatura': 'sube la temperatura',
  'detalle.pronostico.causa.bajaTemperatura': 'baja la temperatura',
  'detalle.pronostico.causa.amainaViento': 'amaina el viento',
  'detalle.pronostico.causa.arreciaViento': 'se levanta viento',
  'detalle.pronostico.causa.lluviaPrevista': 'lluvia prevista',
  'detalle.pronostico.aria': 'Próximas 4 horas: {direccion}, {causa}',
  'detalle.pronostico.ariaSinCausa': 'Próximas 4 horas: {direccion}',
  'detalle.cargando': 'Cargando datos de la playa...',
  'detalle.errorCarga': 'No se pudo cargar el detalle de la playa',
  'detalle.sinRespuesta': 'Sin respuesta del servidor',
  'detalle.comoLlegar': 'Cómo llegar',
  'detalle.verEnMapa': 'Ver en el mapa',
  'detalle.estadoBano': 'Estado para bañarse (según {operador})',
  'detalle.banderaAria': 'bandera',
  'detalle.vigilancia': 'Vigilancia: {horario}',
  'detalle.registradaHoy': 'Registrada hoy a las {hora}',
  'detalle.registradaAyer': 'Registrada ayer a las {hora}',
  'detalle.registradaFecha': 'Registrada el {fecha} a las {hora}',
  'detalle.temperatura': 'Temperatura',
  'detalle.agua': 'Agua',
  'detalle.viento': 'Viento',
  'detalle.oleaje': 'Oleaje',
  'detalle.cielo': 'Cielo',
  'detalle.sensacion': 'Sensación',
  'detalle.indiceUV': 'Índice UV máx.',
  'detalle.max': 'Máx.',
  'detalle.aguaGrados': 'Agua {temp}°C',
  'detalle.lloviendoAhora': 'Lloviendo ahora',
  'detalle.lluviaUltimaHora': 'Lluvia en la última hora',
  'detalle.lluviaPrevistaHora': 'Lluvia prevista hacia las {hora}',
  'detalle.lluviaPrevistaHoy': 'Lluvia prevista hoy',
  'detalle.previsionAemet': 'Previsión (AEMET)',
  'detalle.periodoManana': 'Mañana',
  'detalle.periodoTarde': 'Tarde',
  'detalle.sensacionTermica': 'Sensación térmica',
  'detalle.avisoLitoral': 'Aviso litoral',
  'detalle.mareas': 'Mareas',
  'detalle.expandir': 'Expandir',
  'detalle.contraer': 'Contraer',
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

  // ---- Data provenance ----
  'datos.enDirectoFuente': 'Observación en directo de {fuente}',
  'datos.estatico': 'Información fija de la playa, no cambia a diario',
  'datos.webcamExterna': 'Servicio externo: la app no comprueba si emite',

  // ---- Tides ----
  'marea.subiendo': 'Subiendo',
  'marea.bajando': 'Bajando',
  'marea.pleamar': 'Pleamar',
  'marea.bajamar': 'Bajamar',

  // ---- Cruz Roja (card) ----
  'cruzroja.vigilanciaCobertura': 'Vigilancia y cobertura',
  'cruzroja.sinInfo': 'Información de {operador} aún no disponible',
  'cruzroja.banderaActual': 'Bandera actual',
  'cruzroja.coberturaDesde': 'Cobertura desde',
  'cruzroja.coberturaHasta': 'Cobertura hasta',
  'cruzroja.horario': 'Horario',
  'cruzroja.ultimaActualizacion': 'Última actualización',

  // ---- Webcam (detail card) ----
  'webcam.enDirecto': 'Webcam en directo',
  'webcam.vistaPanoramica': 'Vista panorámica de la zona',
  'webcam.cercana': 'Webcam cercana',
  'webcam.abrir': 'Abrir webcam',

  // ---- Beach attributes (keys aligned with ATTR_CONFIG) ----
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

/** Valid bases for tPlural(): `${base}_one` and `${base}_other` must exist. */
export type BasePlural = 'lista.contador' | 'home.playasBadge';
