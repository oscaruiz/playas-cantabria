import React from 'react';
import { IonIcon } from '@ionic/react';
import { videocamOutline } from 'ionicons/icons';
import { PlayaDetalle as PlayaDetalleData } from '../../services/api';
import { claveCoberturaWebcam } from '../../utils/beachHelpers';
import { useIdioma } from '../../i18n/IdiomaContext';
import { DataStatus } from '../../features/provenance/SourceAndFreshness';

/**
 * Beach webcam as an external LINK (never embedded). The title shows the
 * coverage (exact / shared panoramic / nearby) so as not to mislead.
 * Hidden entirely if there is no webcam or it is disabled.
 */
export const WebcamCard: React.FC<{ webcam?: PlayaDetalleData['webcam'] }> = ({ webcam }) => {
  const { t } = useIdioma();
  if (!webcam || webcam.estado === 'desactivada') return null;

  return (
    <section className="detail-section webcam-section">
      <h3 className="section-kicker">{t(claveCoberturaWebcam(webcam.cobertura))}</h3>
      <a
        className="webcam-open-link"
        href={webcam.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <IonIcon icon={videocamOutline} aria-hidden="true" /> {t('webcam.abrir')}
      </a>
      {/* The link is editorial data; whether the camera is broadcasting is
          not something this app knows — so it says exactly that. */}
      <DataStatus clave="datos.webcamExterna" />
    </section>
  );
};

export default WebcamCard;
