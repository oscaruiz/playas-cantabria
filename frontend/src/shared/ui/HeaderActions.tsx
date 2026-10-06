import React, { useEffect, useRef, useState } from 'react';
import { informationCircleOutline, logoGithub, mailOutline, openOutline } from 'ionicons/icons';
import { IonIcon } from '@ionic/react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';
import LanguageSelector from '../../../../../../Dev/playas-cantabria/frontend/src/shared/ui/LanguageSelector';
import { GITHUB, EMAIL } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/config/contact';
import './HeaderActions.css';

/* A phone header does not fit the brand title plus two controls: "Playas de
   Cantabria" in Pacifico asks for ~313px on its own and the ⓘ and the pill ask
   for another ~200. Above this width the pill rides in the bar; below it, it
   drops into the menu. It is decided in JS and not with a media query on
   purpose: rendering it twice and hiding one copy would put two ES/EN pairs in
   the accessibility tree, which is worse than the layout it fixes. */
const PILL_IN_BAR = '(min-width: 560px)';

function usePillInBar(): boolean {
  const [inBar, setInBar] = useState(
    () => window.matchMedia?.(PILL_IN_BAR).matches ?? true,
  );

  useEffect(() => {
    const mq = window.matchMedia?.(PILL_IN_BAR);
    if (!mq?.addEventListener) return undefined;
    const onChange = (event: MediaQueryListEvent) => setInBar(event.matches);
    setInBar(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return inBar;
}

/** Compact project-information menu, placed in the header like common content apps. */
const HeaderActions: React.FC = () => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pillInBar = usePillInBar();

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
            className="header-info-external"
            href={GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`GitHub ${t('nav.abreFuera')}`}
          >
            <IonIcon icon={logoGithub} aria-hidden="true" />
            <span>GitHub</span>
            <IonIcon className="header-info-exit" icon={openOutline} aria-hidden="true" />
          </a>
          <a
            role="menuitem"
            className="header-info-external"
            href={`mailto:${EMAIL}`}
            aria-label={`${t('nav.enviarEmail')} ${t('nav.abreFuera')}`}
          >
            <IonIcon icon={mailOutline} aria-hidden="true" />
            <span>{t('nav.enviarEmail')}</span>
            <IonIcon className="header-info-exit" icon={openOutline} aria-hidden="true" />
          </a>
          {/* El rótulo va decorativo: el propio selector ya se anuncia como un
              grupo llamado "Idioma", y repetirlo lo diría dos veces. */}
          {!pillInBar && (
            <div className="header-info-language" role="none">
              <span aria-hidden="true">{t('selector.idioma')}</span>
              <LanguageSelector />
            </div>
          )}
        </div>
      )}
      {pillInBar && <LanguageSelector />}
    </div>
  );
};

export default HeaderActions;
