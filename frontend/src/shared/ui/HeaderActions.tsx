import React, { useEffect, useRef, useState } from 'react';
import { informationCircleOutline, logoGithub, mailOutline, openOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';
import { Link } from 'react-router-dom';
import { useIdioma } from '../i18n/IdiomaContext';
import SelectorIdioma from './SelectorIdioma';
import { GITHUB, EMAIL } from '../config/contacto';
import './HeaderActions.css';

/** Compact project-information menu, placed in the header like common content apps. */
const HeaderActions: React.FC = () => {
  const { t } = useIdioma();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="header-actions" ref={ref}>
      <button
        type="button"
        className="header-info-button"
        aria-label={t('nav.informacion')}
        aria-expanded={open}
        aria-controls="header-info-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <IonIcon icon={informationCircleOutline} aria-hidden="true" />
        <span>{t('nav.sobre')}</span>
      </button>
      {open && (
        <div className="header-info-menu" id="header-info-menu" role="menu">
          <Link role="menuitem" to="/acerca-de" onClick={() => setOpen(false)}>{t('nav.acerca')}</Link>
          <Link role="menuitem" to="/privacidad" onClick={() => setOpen(false)}>{t('nav.privacidad')}</Link>
          {/* Los dos de abajo SALEN de la app, y el icono de la derecha lo
              anuncia antes de pulsar. Va marcado como decorativo porque quien
              usa lector ya lo oye en el nombre accesible del enlace. */}
          <a
            role="menuitem"
            className="header-info-externo"
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`GitHub ${t('nav.abreFuera')}`}
          >
            <IonIcon icon={logoGithub} aria-hidden="true" />
            <span>GitHub</span>
            <IonIcon className="header-info-salida" icon={openOutline} aria-hidden="true" />
          </a>
          <a
            role="menuitem"
            className="header-info-externo"
            href={`mailto:${EMAIL}`}
            aria-label={`${t('nav.enviarEmail')} ${t('nav.abreFuera')}`}
          >
            <IonIcon icon={mailOutline} aria-hidden="true" />
            <span>{t('nav.enviarEmail')}</span>
            <IonIcon className="header-info-salida" icon={openOutline} aria-hidden="true" />
          </a>
        </div>
      )}
      <SelectorIdioma />
    </div>
  );
};

export default HeaderActions;
