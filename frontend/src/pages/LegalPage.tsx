import React from 'react';
import { IonContent, IonFooter, IonIcon, IonPage } from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';
import { Link, useHistory } from 'react-router-dom';
import BottomNavBar from '../shared/ui/BottomNavBar';
import HeaderActions from '../shared/ui/HeaderActions';
import SeoHead from '../shared/seo/SeoHead';
import { useIdioma } from '../shared/i18n/IdiomaContext';
import { AUTOR, AUTOR_GITHUB, GITHUB, EMAIL } from '../shared/config/contacto';
import { REGION } from '../shared/config/region';
import './LegalPage.css';

// Brand name from region.json, so the legal texts follow each region's build.
const MARCA = REGION.branding.appName;

const EnlacesFuentes: React.FC = () => (
  <ul>
    <li><strong>AEMET.</strong> Información elaborada utilizando, entre otras, la obtenida de la Agencia Estatal de Meteorología. Los datos pueden combinarse o transformarse para generar información propia.</li>
    <li>
      <strong>OpenWeather.</strong>{' '}
      <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">Weather data provided by OpenWeather.</a>
      {/* TODO: Verify the contracted OpenWeather plan and whether it also requires displaying its logo. */}
    </li>
    <li>
      <strong>Open-Meteo.</strong>{' '}
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Datos meteorológicos de Open-Meteo, adaptados para las recomendaciones de {MARCA}.</a>{' '}
      El proyecto es actualmente gratuito y no comercial.
    </li>
    <li>
      <strong>OpenStreetMap.</strong>{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. La atribución visible del mapa se mantiene además junto al propio mapa.
    </li>
  </ul>
);

const AcercaEs: React.FC = () => (
  <>
    <section><h2>Qué es el proyecto</h2><p>{MARCA} es un proyecto personal, gratuito e independiente. Reúne información meteorológica, previsiones, mareas, radiación UV, características de las playas, banderas y vigilancia. Los rankings, puntuaciones y recomendaciones se generan automáticamente y toda la información tiene carácter orientativo. El <a href={GITHUB} target="_blank" rel="noopener noreferrer">código fuente está disponible públicamente en GitHub</a>.</p></section>
    <section><h2>Independencia</h2><p>No es un servicio oficial ni está afiliado, patrocinado, gestionado o respaldado por el Gobierno de Cantabria, AEMET, Cruz Roja Española, los ayuntamientos, OpenWeather, Open-Meteo u OpenStreetMap. Estas entidades se mencionan únicamente para identificar las fuentes de información.</p></section>
    <section><h2>Seguridad y responsabilidad</h2><p>Las previsiones, mareas, datos UV, lluvia, banderas, vigilancia y recomendaciones pueden contener errores o estar desactualizados. Una bandera verde mostrada en la aplicación no garantiza que el baño sea seguro. Prevalecen siempre la bandera física de la playa, las condiciones reales, la señalización y las indicaciones de socorristas, autoridades y servicios de emergencia.</p><p>{MARCA} no garantiza la exactitud, disponibilidad o actualización permanente de los datos. Las recomendaciones no sustituyen una evaluación personal de las condiciones.</p><blockquote>La información sobre banderas y vigilancia puede proceder de fuentes externas, copias temporales o procesos automatizados y puede no reflejar la situación existente en la playa. La bandera física y las instrucciones del personal de vigilancia y de las autoridades prevalecen siempre.</blockquote></section>
    <section><h2>Fuentes y atribuciones</h2><EnlacesFuentes /><h3>Cruz Roja Española</h3><p>Determinados datos sobre banderas, cobertura y horarios de vigilancia se obtienen de información publicada en sus servicios web. No se ha verificado una API pública oficial documentada. Los datos pueden contener retrasos, errores o diferencias respecto a la situación real.</p><p>La mención de Cruz Roja identifica únicamente la fuente consultada y no implica autorización, colaboración, validación o respaldo. {MARCA} no utiliza el emblema o logotipo de Cruz Roja como identidad propia. La bandera física presente en la playa prevalece siempre.</p></section>
    <section><h2>Código y datos externos</h2><p>La licencia del código fuente no cubre automáticamente los datos de proveedores externos, ni las marcas, logotipos, nombres comerciales o contenidos pertenecientes a terceros. Estos elementos permanecen sujetos a las condiciones de sus respectivos titulares.</p></section>
    <section><h2>Contacto</h2><p>Responsable: <a href={AUTOR_GITHUB} target="_blank" rel="noopener noreferrer"><strong>{AUTOR}</strong></a><br />Correo: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p><p>Puede utilizarse para comunicar datos incorrectos o banderas desactualizadas, solicitar correcciones o retirada de información y avisar de problemas de atribución o técnicos.</p></section>
  </>
);

const PrivacidadEs: React.FC = () => (
  <>
    <section><h2>Responsable</h2><p><a href={AUTOR_GITHUB} target="_blank" rel="noopener noreferrer"><strong>{AUTOR}</strong></a><br /><a href={`mailto:${EMAIL}`}>{EMAIL}</a></p></section>
    <section><h2>Geolocalización opcional</h2><p>La aplicación solicita opcionalmente la ubicación del navegador para ordenar playas por distancia, mostrar las más cercanas y situar al usuario en el mapa. Puede rechazarse el permiso y la aplicación seguirá funcionando sin ubicación.</p><p>La última ubicación válida se guarda durante cinco minutos en el almacenamiento local del dispositivo. El código revisado la utiliza localmente para cálculos de distancia y mapa; no la incorpora a las peticiones de la API de {MARCA}. Puede borrarse eliminando los datos del sitio desde el navegador o los datos de la aplicación.</p></section>
    <section><h2>Almacenamiento local</h2><p>La configuración actual utiliza <code>localStorage</code> para recordar favoritos, el idioma, una última ubicación temporal y una copia de respaldo del catálogo de playas (hasta 24 horas). No se han encontrado usos propios de <code>sessionStorage</code>, IndexedDB ni Capacitor Preferences.</p><p>La PWA también precarga archivos de la aplicación y mantiene cachés temporales de imágenes y respuestas de playas para funcionamiento y disponibilidad con conexiones deficientes.</p><p>Los favoritos pueden eliminarse desmarcando cada estrella. El resto puede borrarse desde la configuración del navegador, eliminando los datos del sitio o, cuando corresponda, desinstalando la PWA y eliminando sus datos. Los controles del navegador o sistema pueden conservar opciones separadas para permisos y datos.</p></section>
    <section><h2>Registros técnicos y proveedores</h2><p>Los proveedores confirmados de alojamiento o infraestructura son Firebase Hosting/Google para la web, Render para la API y Upstash como caché opcional del servidor cuando está configurada. Estos proveedores pueden tratar datos técnicos como dirección IP, navegador, URL solicitada, fecha y hora, errores e información necesaria para la seguridad y el funcionamiento.</p></section>
    <section><h2>Finalidades</h2><ul><li>Proporcionar las funciones de la aplicación.</li><li>Ordenar playas por distancia.</li><li>Recordar favoritos y preferencias.</li><li>Mantener la seguridad y estabilidad del servicio y diagnosticar errores.</li><li>Responder a consultas enviadas por correo electrónico.</li></ul></section>
    <section><h2>Cookies y tecnologías similares</h2><p>En la configuración revisada actualmente no se han identificado herramientas de analítica publicitaria ni tecnologías destinadas al seguimiento entre sitios. Sí existen tecnologías necesarias de almacenamiento y caché descritas arriba; el navegador o los proveedores pueden aplicar sus propios mecanismos técnicos.</p>{/* TODO: Review this statement before adding analytics, advertising, tracking, personalized content, or third-party videos/resources that install non-essential technologies. */}</section>
    <section><h2>Derechos</h2><p>Puede solicitar acceso, rectificación, supresión, oposición, limitación y, cuando corresponda, portabilidad escribiendo a <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. También puede presentar una reclamación ante la <a href="https://www.aepd.es/" target="_blank" rel="noopener noreferrer">Agencia Española de Protección de Datos</a>.</p></section>
  </>
);

const LegalPage: React.FC<{ tipo: 'acerca' | 'privacidad' }> = ({ tipo }) => {
  const { idioma, t } = useIdioma();
  const history = useHistory();
  const acerca = tipo === 'acerca';
  // Title and description come from the SAME templates the prerender bakes
  // into the HTML (shared/seo/metadata.js), so the tag a crawler reads and the
  // one the app sets cannot drift. They also carry `{region}`: the title used
  // to say "Playas Cantabria" verbatim, which breaks the moment another region
  // is built.
  const titulo = t(acerca ? 'seo.tituloAcerca' : 'seo.tituloPrivacidad');
  const descripcion = t(acerca ? 'seo.descAcerca' : 'seo.descPrivacidad');
  // The heading is the title without the "| <marca>" suffix.
  const encabezado = titulo.split(' | ')[0];

  return (
    <IonPage className="legal-page">
      <SeoHead titulo={titulo} descripcion={descripcion} rutaCanonica={acerca ? '/acerca-de' : '/privacidad'} />
      <header className="legal-header">
        <div className="legal-header-izq">
          {/* Estas páginas se abren desde el menú ⓘ de cualquier pantalla, así
              que volver a la portada no es volver: hay que devolver a la ficha
              o al listado desde donde se entró. Si se ha llegado por un enlace
              directo no hay historia a la que volver, y entonces sí, portada. */}
          <button
            className="pd-back-btn"
            onClick={() => (history.length > 1 ? history.goBack() : history.push('/'))}
            aria-label={t('detalle.volver')}
          >
            <IonIcon icon={chevronBackOutline} aria-hidden="true" />
          </button>
          <Link to="/" className="legal-home">{MARCA}</Link>
        </div>
        <HeaderActions />
      </header>
      {/* Sin `fullscreen`: eso hace que el contenido se pinte DEBAJO de la
          cabecera, que es lo que se quiere con un IonHeader translúcido y no
          con un <header> normal. Aquí tapaba el botón de volver y el enlace
          de inicio, y dejaba las acciones flotando en blanco sobre el crema. */}
      <IonContent>
        <main className="legal-main">
          <h1>{encabezado}</h1>
          {idioma === 'es' ? (acerca ? <AcercaEs /> : <PrivacidadEs />) : <EnglishContent tipo={tipo} />}
        </main>
      </IonContent>
      <IonFooter className="ion-no-border"><BottomNavBar /></IonFooter>
    </IonPage>
  );
};

const EnglishContent: React.FC<{ tipo: 'acerca' | 'privacidad' }> = ({ tipo }) => tipo === 'acerca' ? (
  <>
    <section><h2>About the project</h2><p>{MARCA} is a personal, free and independent project. It brings together weather, forecasts, tides, UV radiation, beach features, flags and lifeguard information. Rankings, scores and recommendations are generated automatically and all information is indicative. The <a href={GITHUB} target="_blank" rel="noopener noreferrer">source code is public on GitHub</a>.</p></section>
    <section><h2>Independence</h2><p>This is not an official service and is not affiliated with, sponsored, managed or endorsed by the Government of Cantabria, AEMET, the Spanish Red Cross, local councils, OpenWeather, Open-Meteo or OpenStreetMap. They are named only to identify information sources.</p></section>
    <section><h2>Safety and responsibility</h2><p>Forecasts, tides, UV, rain, flags, lifeguard coverage and recommendations may be wrong or out of date. A green flag in the app does not guarantee safe bathing. The physical flag, actual conditions, signs and instructions from lifeguards, authorities and emergency services always prevail.</p><p>{MARCA} does not guarantee permanent accuracy, availability or freshness. Recommendations do not replace your own assessment.</p><blockquote>Flag and lifeguard information may come from external sources, temporary copies or automated processes and may not reflect the situation at the beach. The physical flag and instructions from lifeguards and authorities always prevail.</blockquote></section>
    <section><h2>Sources and attribution</h2><EnlacesFuentes /><h3>Spanish Red Cross</h3><p>Some flag, coverage and lifeguard schedule data comes from information published through its web services. No documented official public API has been verified. Data may be delayed, wrong or differ from actual conditions.</p><p>The name identifies only the consulted source and does not imply permission, collaboration, validation or endorsement. {MARCA} does not use the Red Cross emblem or logo as its own identity. The physical flag always prevails.</p></section>
    <section><h2>Code and external data</h2><p>The source-code licence does not automatically cover external-provider data, third-party trademarks, logos, trade names or content. Those remain subject to their owners&apos; terms.</p></section>
    <section><h2>Contact</h2><p>Controller: <a href={AUTOR_GITHUB} target="_blank" rel="noopener noreferrer"><strong>{AUTOR}</strong></a><br />Email: <a href={`mailto:${EMAIL}`}>{EMAIL}</a></p><p>Use this address to report incorrect data, stale flags, attribution or technical problems, or to request corrections or removal.</p></section>
  </>
) : (
  <>
    <section><h2>Controller</h2><p><a href={AUTOR_GITHUB} target="_blank" rel="noopener noreferrer"><strong>{AUTOR}</strong></a><br /><a href={`mailto:${EMAIL}`}>{EMAIL}</a></p></section>
    <section><h2>Optional geolocation</h2><p>The app optionally requests browser location to sort beaches by distance, show nearby beaches and locate you on the map. You may refuse and the app continues to work without it.</p><p>The last valid location is stored locally for five minutes. The reviewed code uses it locally for distance and map calculations and does not add it to {MARCA} API requests. Clear it by deleting site or app data.</p></section>
    <section><h2>Local storage</h2><p>The current configuration uses <code>localStorage</code> for favourites, language, a temporary last location and a backup beach catalogue (up to 24 hours). No own use of <code>sessionStorage</code>, IndexedDB or Capacitor Preferences was found.</p><p>The PWA also precaches app files and temporarily caches images and beach responses for operation on poor connections. Remove favourites by unmarking stars; clear the rest in browser settings by deleting site data, or uninstall the PWA and delete its data where applicable.</p></section>
    <section><h2>Technical logs and providers</h2><p>Confirmed infrastructure providers are Firebase Hosting/Google for the web, Render for the API and optional Upstash server caching when configured. They may process IP address, browser, requested URL, date and time, errors and data needed for security and operation.</p></section>
    <section><h2>Purposes</h2><ul><li>Provide app functions.</li><li>Sort beaches by distance.</li><li>Remember favourites and preferences.</li><li>Maintain service security and stability and diagnose errors.</li><li>Reply to email enquiries.</li></ul></section>
    <section><h2>Cookies and similar technologies</h2><p>In the configuration currently reviewed, no advertising analytics tools or technologies intended for cross-site tracking were identified. Necessary storage and caching technologies are described above; browsers or providers may use their own technical mechanisms.</p>{/* TODO: Review before adding analytics, advertising, tracking, personalized content, or third-party videos/resources that install non-essential technologies. */}</section>
    <section><h2>Your rights</h2><p>You may request access, correction, deletion, objection, restriction and, where applicable, portability at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. You may also complain to the <a href="https://www.aepd.es/" target="_blank" rel="noopener noreferrer">Spanish Data Protection Agency</a>.</p></section>
  </>
);

export default LegalPage;
