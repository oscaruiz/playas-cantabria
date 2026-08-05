import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { imageOutline } from 'ionicons/icons';
import type { FeaturedBeach, PrevisionHora } from '../../../services/api';
import { useIdioma } from '../../../shared/i18n/IdiomaContext';
import { REGION } from '../../../shared/config/region';
import { resumenTarjeta } from '../domain/resumenTarjeta';
import { tarjetaComoPng } from '../infrastructure/tarjetaCanvas';
import { compartirImagen, nombreArchivoTarjeta } from '../infrastructure/compartirImagen';

type Estado = 'listo' | 'generando' | 'descargada';

/**
 * Shares today's reading as an image. Separate from the plain "Share" next to
 * it on purpose: that one sends a link, which is useless in a group where
 * nobody is going to tap it, and this one sends something you can read in the
 * chat itself.
 */
const BotonCompartirEstado: React.FC<{
  playa: { nombre: string; municipio: string };
  puntuada: FeaturedBeach;
  url: string;
  prevision?: { viento?: string | null; oleaje?: string | null };
  horas?: PrevisionHora[] | null;
  mareas?: { pleamar: string[]; bajamar: string[] } | null;
  puertoMareas?: string | null;
}> = ({ playa, puntuada, url, prevision, horas, mareas, puertoMareas }) => {
  const { t, idioma } = useIdioma();
  const [estado, setEstado] = useState<Estado>('listo');

  const compartir = async () => {
    if (estado === 'generando') return;
    setEstado('generando');
    const ahora = new Date();
    try {
      const png = await tarjetaComoPng(
        resumenTarjeta({
          playa,
          puntuada,
          marca: REGION.branding.appName,
          sitio: new URL(url).host,
          prevision,
          horas,
          mareas,
          puertoMareas,
          ahora,
          t,
          idioma,
        }),
      );
      const resultado = await compartirImagen(
        png,
        nombreArchivoTarjeta(playa.nombre, ahora),
        t('seo.tituloDetalle', { nombre: playa.nombre }),
        url,
      );
      // Only the download needs saying: the share sheet already showed itself,
      // and a dismissed sheet was a decision, not a failure.
      if (resultado === 'descargada') {
        setEstado('descargada');
        setTimeout(() => setEstado('listo'), 2500);
        return;
      }
      setEstado('listo');
    } catch {
      // Nothing partial escapes: without an image there is nothing to share,
      // and the button simply goes back to offering it.
      setEstado('listo');
    }
  };

  return (
    <button className="hero-directions-link" onClick={compartir} aria-live="polite">
      <IonIcon icon={imageOutline} aria-hidden="true" />{' '}
      {estado === 'generando'
        ? t('detalle.generandoImagen')
        : estado === 'descargada'
          ? t('detalle.imagenDescargada')
          : t('detalle.compartirEstado')}
    </button>
  );
};

export default BotonCompartirEstado;
