/**
 * Base dictionary in Spanish. It is the source of truth for the keys:
 * `ClaveTexto` is inferred from here and en.ts must cover them all (the
 * compiler guarantees it via `satisfies`).
 *
 * Interpolation: placeholders are written as {nombre} and are filled
 * with the second argument of t(). Keys with the _one/_other suffix
 * are plural forms and are resolved with tPlural().
 */
import { PLANTILLAS_SEO, ETIQUETAS_ATTR } from '../seo/metadata';
import { LANDINGS } from '../seo/landings';

const TEXTOS_LANDINGS = Object.fromEntries(LANDINGS.map((l) => [l.id, l.textos]));

export const es = {
  // ---- App / global ----
  'app.titulo': '{marca}',
  'app.tituloDocumento': '{marca}',

  // ---- Bottom navigation ----
  'nav.principal': 'Navegación principal',
  'nav.inicio': 'Inicio',
  'nav.playas': 'Playas',
  'nav.mapa': 'Mapa',
  'nav.informacion': 'Información del proyecto',
  'nav.sobre': 'Sobre la app',
  'nav.acerca': 'Acerca de y condiciones',
  'nav.privacidad': 'Privacidad y almacenamiento',
  /** Sufijo del nombre accesible en los enlaces que salen de la app. */
  'nav.abreFuera': '(se abre fuera de la app)',
  'nav.enviarEmail': 'Enviar email',

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
  'home.favoritas': 'Tus playas favoritas',

  // ---- Install as an app (PWA) ----
  'instalar.chip': 'Instalar app',
  'instalar.abrir': 'Abrir app',
  'instalar.iosTitulo': 'Añadir a la pantalla de inicio',
  'instalar.iosPaso1': 'Toca el botón Compartir de la barra del navegador.',
  'instalar.iosPaso2': 'Elige «Añadir a pantalla de inicio».',

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
  'lista.filtroWebcam': 'Mostrar solo playas con webcam',
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
  'detalle.bandera': 'Bandera',
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

  // ---- SEO (document head per route) ----
  // The Spanish templates live in seo/metadata.js, shared with the
  // prerender script so the baked HTML and the client can never drift.
  'seo.tituloInicio': PLANTILLAS_SEO.tituloInicio,
  'seo.descInicio': PLANTILLAS_SEO.descInicio,
  'seo.tituloLista': PLANTILLAS_SEO.tituloLista,
  'seo.descLista': PLANTILLAS_SEO.descLista,
  'seo.tituloAcerca': PLANTILLAS_SEO.tituloAcerca,
  'seo.descAcerca': PLANTILLAS_SEO.descAcerca,
  'seo.tituloPrivacidad': PLANTILLAS_SEO.tituloPrivacidad,
  'seo.descPrivacidad': PLANTILLAS_SEO.descPrivacidad,
  'seo.tituloMapa': PLANTILLAS_SEO.tituloMapa,
  'seo.descMapa': PLANTILLAS_SEO.descMapa,
  'seo.tituloDetalle': PLANTILLAS_SEO.tituloDetalle,
  'seo.descDetalle': PLANTILLAS_SEO.descDetalle,
  'seo.tituloMunicipio': PLANTILLAS_SEO.tituloMunicipio,
  'seo.descMunicipio': PLANTILLAS_SEO.descMunicipio,
  'seo.tituloMunicipios': PLANTILLAS_SEO.tituloMunicipios,
  'seo.descMunicipios': PLANTILLAS_SEO.descMunicipios,
  'municipios.titulo': 'Municipios con playa',
  'municipios.intro': 'Los municipios de {region} con playa en el catálogo. Cada uno lleva a sus playas y su estado.',
  'municipio.verPlayas': 'Ver todas las playas de {municipio}',
  'detalle.municipio': 'Municipio',
  'noEncontrada.texto': 'Esta dirección no existe en la aplicación.',
  'detalle.compartir': 'Compartir',
  'detalle.generandoImagen': 'Generando imagen…',
  'detalle.otrasPlayasMunicipio': 'Otras playas del municipio de {municipio}',
  'detalle.enlaceCopiado': 'Enlace copiado',
  'seo.tituloNoEncontrada': 'Página no encontrada | {marca}',
  'seo.descNoEncontrada': 'Esta dirección no corresponde a ninguna playa ni municipio del catálogo de {region}.',

  // ---- Municipality and curated landing pages (Spanish texts shared with
  // the prerender script via seo/landings.js) ----
  'municipio.titulo': 'Playas del Municipio de {municipio}',
  'municipio.intro': 'Las playas de {municipio} con enlace al estado de hoy de cada una.',
  'municipio.desconocido': 'No conocemos ese municipio. Consulta el listado completo de playas.',
  'landing.playas-con-webcam.titulo': TEXTOS_LANDINGS['playas-con-webcam'].titulo,
  'landing.playas-con-webcam.intro': TEXTOS_LANDINGS['playas-con-webcam'].intro,
  'landing.playas-accesibles.titulo': TEXTOS_LANDINGS['playas-accesibles'].titulo,
  'landing.playas-accesibles.intro': TEXTOS_LANDINGS['playas-accesibles'].intro,
  'landing.playas-con-socorrista.titulo': TEXTOS_LANDINGS['playas-con-socorrista'].titulo,
  'landing.playas-con-socorrista.intro': TEXTOS_LANDINGS['playas-con-socorrista'].intro,
  'landing.playas-para-surf.titulo': TEXTOS_LANDINGS['playas-para-surf'].titulo,
  'landing.playas-para-surf.intro': TEXTOS_LANDINGS['playas-para-surf'].intro,

  // ---- Atribuciones exigidas por cada fuente ----
  // El `{fuente}` de cada frase es el nombre acreditado, y va enlazado a los
  // términos de esa fuente. La frase de AEMET es la suya, literal: solo se le
  // añade detrás el crédito enlazado.
  'atribucion.aemet':
    'Información elaborada utilizando, entre otras, la obtenida de la Agencia Estatal de Meteorología. Fuente: {fuente}.',
  'atribucion.openweather': 'Datos meteorológicos proporcionados por {fuente}.',
  'atribucion.openmeteo':
    'Datos meteorológicos de {fuente}, adaptados por {marca}: se transforman para calcular la puntuación.',
  'atribucion.banderas': 'Estado de las banderas publicado por {fuente}.',
  'atribucion.independiente':
    '{marca} es un proyecto independiente: ninguna de estas fuentes lo respalda ni colabora con él.',

  // ---- Etiquetas del control ⓘ ----
  // Cortas y por CONTENIDO: quien ve la ficha tiene que poder decidir cuál
  // abrir sin abrirlas. Un rótulo genérico repetido en cinco tarjetas no
  // distingue el aviso de seguridad del crédito de una fuente.
  'info.aviso': 'Aviso',
  'info.fuente': 'Fuente',
  'info.sobreDatos': 'Sobre estos datos',
  // El nombre accesible sí dice a qué bloque pertenece: con cinco botones en
  // la pantalla, «Aviso» a secas no ubica a quien navega con lector.
  'info.aria.bandera': 'Aviso sobre la bandera',
  'info.aria.ranking': 'Aviso sobre la recomendación',
  'info.aria.prevision': 'Fuente de la previsión',
  'info.aria.horas': 'Fuente de las próximas horas',
  'info.aria.vigilancia': 'Fuente del servicio de vigilancia',
  'info.aria.ficha': 'Sobre los datos de esta ficha',

  // ---- Avisos junto a la información sensible ----
  // Uno por pantalla y pegado a lo que matiza: la bandera y la puntuación son
  // lo único sobre lo que alguien decide meterse al agua.
  'aviso.banderas':
    'Información orientativa y potencialmente desactualizada. Comprueba siempre la bandera presente en la playa y sigue las indicaciones del personal de vigilancia y de las autoridades.',
  'aviso.ranking':
    'Recomendación automática basada en previsiones y datos disponibles. No garantiza la seguridad ni las condiciones reales de la playa.',

  // ---- Data provenance ----
  'datos.fuente': 'Datos de {fuente}',
  // Retirada por antigüedad: el valor no se envejece con un aviso, se quita.
  'datos.noDisponible': 'Dato no disponible: la última observación es de hace demasiado tiempo,',
  // Naturaleza de lo que se enseña. «Estimado» es lo único que no se deduce
  // mirando la pantalla, así que es lo único que se nombra valor por valor.
  'datos.estimados': 'Valores estimados a partir de otros datos: {campos}.',
  'datos.estimado.sensacion': 'sensación térmica',
  'datos.estimado.viento': 'viento',
  'datos.estimado.oleaje': 'oleaje',
  'datos.estimado.uv': 'índice UV',
  'datos.estimado.agua': 'temperatura del agua',
  // Caché: la respuesta puede ser bastante más vieja que la petición.
  'datos.calculado': 'Datos calculados el',
  'datos.desdeCache': 'servidos desde caché',
  'datos.enDirectoFuente': 'Observación en directo de {fuente}',
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

  // ---- Beach attributes (keys aligned with ATTR_CONFIG; labels shared
  // with the prerender script via seo/metadata.js) ----
  'attr.duchas': ETIQUETAS_ATTR.duchas,
  'attr.aseos': ETIQUETAS_ATTR.aseos,
  'attr.parking': ETIQUETAS_ATTR.parking,
  'attr.accesible': ETIQUETAS_ATTR.accesible,
  'attr.chiringuito': ETIQUETAS_ATTR.chiringuito,
  'attr.surf': ETIQUETAS_ATTR.surf,
  'attr.mascotas': ETIQUETAS_ATTR.mascotas,
  'attr.socorrismo': ETIQUETAS_ATTR.socorrismo,
  'attr.nudista': ETIQUETAS_ATTR.nudista,
  'attr.accesoBanista': ETIQUETAS_ATTR.accesoBanista,
  'attr.submarinismo': ETIQUETAS_ATTR.submarinismo,
} as const;

export type ClaveTexto = keyof typeof es;

/** Valid bases for tPlural(): `${base}_one` and `${base}_other` must exist. */
export type BasePlural = 'lista.contador' | 'home.playasBadge';
