import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { shareSocialOutline } from 'ionicons/icons';
import type { FeaturedBeach, PrevisionHora } from '../../../services/api';
import { useIdioma } from '../../../shared/i18n/IdiomaContext';
import { REGION } from '../../../shared/config/region';
import { resumenTarjeta } from '../domain/resumenTarjeta';
import { tarjetaComoPng } from '../infrastructure/tarjetaCanvas';
import { compartirPlaya, nombreArchivoTarjeta } from '../infrastructure/compartirImagen';

type Estado = 'listo' | 'generando' | 'copiado';

/**
 * Shares the beach: today's reading as an image, with the canonical link in
 * the caption. The link alone is worth little in a group chat where nobody is
 * going to tap it; the card can be read in the chat itself, and still carries
 * the way back.
 *
 * The card is only built when there is a score — it IS the reading, and
 * without it the image would say nothing the link does not say better. Then
 * this behaves exactly as it did before the card existed.
 */
const BotonCompartir: React.FC<{
  playa: { nombre: string; municipio: string };
  puntuada: FeaturedBeach | null;
  url: string;
  prevision?: { viento?: string | null; oleaje?: string | null };
  horas?: PrevisionHora[] | null;
  mareas?: { pleamar: string[]; bajamar: string[] } | null;
  puertoMareas?: string | null;
}> = ({ playa, puntuada, url, prevision, horas, mareas, puertoMareas }) => {
  const { t, idioma } = useIdioma();
  const [estado, setEstado] = useState<Estado>('listo');

  const alPulsar = async () => {
    if (estado === 'generando') return;
    const ahora = new Date();
    const titulo = t('seo.tituloDetalle', { nombre: playa.nombre });

    let imagen: Blob | null = null;
    if (puntuada) {
      setEstado('generando');
      try {
        imagen = await tarjetaComoPng(
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
      } catch {
        // A canvas that will not paint must not cost the share: the link goes
        // out on its own, which is what this button always did.
      }
    }

    try {
      const resultado = await compartirPlaya({
        imagen,
        nombreArchivo: nombreArchivoTarjeta(playa.nombre, ahora),
        titulo,
        url,
      });
      // Only the clipboard needs saying: the share sheet showed itself, and a
      // dismissed sheet was a decision, not a failure.
      if (resultado === 'enlaceCopiado') {
        setEstado('copiado');
        setTimeout(() => setEstado('listo'), 2000);
        return;
      }
    } catch {
      // The clipboard was denied: nothing to report and nothing to undo.
    }
    setEstado('listo');
  };

  return (
    <button className="hero-directions-link" onClick={alPulsar} aria-live="polite">
      <IonIcon icon={shareSocialOutline} aria-hidden="true" />{' '}
      {estado === 'generando'
        ? t('detalle.generandoImagen')
        : estado === 'copiado'
          ? t('detalle.enlaceCopiado')
          : t('detalle.compartir')}
    </button>
  );
};

export default BotonCompartir;
