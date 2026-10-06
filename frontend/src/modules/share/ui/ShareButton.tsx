import React, { useState } from 'react';
import { IonIcon } from '@ionic/react';
import { shareSocialOutline } from 'ionicons/icons';
import type { FeaturedBeach, HourlyForecast } from '../../../services/api';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { REGION } from '../../../shared/config/region';
import { cardSummary } from '../domain/cardSummary';
import { cardAsPng } from '../infrastructure/cardCanvas';
import { shareBeach, cardFileName } from '../infrastructure/shareImage';

type Status = 'listo' | 'generando' | 'copiado';

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
const ShareButton: React.FC<{
  beach: { nombre: string; municipio: string };
  scored: FeaturedBeach | null;
  url: string;
  forecast?: { wind?: string | null; waves?: string | null };
  hours?: HourlyForecast[] | null;
  tides?: { pleamar: string[]; bajamar: string[] } | null;
  tidePort?: string | null;
}> = ({ beach, scored, url, forecast, hours, tides, tidePort }) => {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<Status>('listo');

  const onPress = async () => {
    if (status === 'generando') return;
    const now = new Date();
    const title = t('seo.tituloDetalle', { nombre: beach.nombre });

    let image: Blob | null = null;
    if (scored) {
      setStatus('generando');
      try {
        image = await cardAsPng(
          cardSummary({
            beach,
            scored,
            brand: REGION.branding.appName,
            site: new URL(url).host,
            forecast,
            hours,
            tides,
            tidePort,
            now,
            t,
            language,
          }),
        );
      } catch {
        // A canvas that will not paint must not cost the share: the link goes
        // out on its own, which is what this button always did.
      }
    }

    try {
      const result = await shareBeach({
        image,
        fileName: cardFileName(beach.nombre, now),
        title,
        url,
      });
      // Only the clipboard needs saying: the share sheet showed itself, and a
      // dismissed sheet was a decision, not a failure.
      if (result === 'enlaceCopiado') {
        setStatus('copiado');
        setTimeout(() => setStatus('listo'), 2000);
        return;
      }
    } catch {
      // The clipboard was denied: nothing to report and nothing to undo.
    }
    setStatus('listo');
  };

  return (
    <button className="hero-directions-link" onClick={onPress} aria-live="polite">
      <IonIcon icon={shareSocialOutline} aria-hidden="true" />{' '}
      {status === 'generando'
        ? t('detalle.generandoImagen')
        : status === 'copiado'
          ? t('detalle.enlaceCopiado')
          : t('detalle.compartir')}
    </button>
  );
};

export default ShareButton;
