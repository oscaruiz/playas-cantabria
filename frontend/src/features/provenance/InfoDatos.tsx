import React, { useId, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { informationCircleOutline } from 'ionicons/icons';
import { useIdioma } from '../../shared/i18n/IdiomaContext';
import type { ClaveTexto } from '../../shared/i18n/es';
import './provenance.css';

/**
 * What a block has to declare — its safety notice or its sources — behind one
 * ⓘ, next to the block.
 *
 * The paragraphs used to be printed inline. Six of them competing in grey
 * under real data is how a warning stops being read: this keeps them one tap
 * away from the value they qualify, instead of in an "about" page nobody
 * opens.
 *
 * The label is the CALLER'S, not this component's: a card whose ⓘ holds a
 * safety caveat says "Aviso" and one holding an attribution says "Fuente".
 * A single generic wording repeated on every card tells the reader nothing
 * about which one is worth opening.
 *
 * The one exception in the app is the OpenStreetMap credit on the map: the
 * OSMF tile policy requires it to be visible WITHOUT interaction, so it stays
 * in Leaflet's own control and never comes through here.
 */
const InfoDatos: React.FC<{
  /** Visible label. Short and specific: "Aviso", "Fuente". */
  etiqueta: ClaveTexto;
  /** Accessible name, which must also say WHICH block it belongs to. */
  aria: ClaveTexto;
  children: React.ReactNode;
  className?: string;
}> = ({ etiqueta, aria, children, className }) => {
  const { t } = useIdioma();
  const [abierto, setAbierto] = useState(false);
  const id = useId();

  return (
    <div className={`info-datos ${className ?? ''}`.trim()}>
      <button
        type="button"
        className="info-datos-btn"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        aria-label={t(aria)}
      >
        <IonIcon icon={informationCircleOutline} aria-hidden="true" />
        <span>{t(etiqueta)}</span>
      </button>
      {abierto && (
        <div className="info-datos-panel" id={id} role="note">
          {children}
        </div>
      )}
    </div>
  );
};

export default InfoDatos;
