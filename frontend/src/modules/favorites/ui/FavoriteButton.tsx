import React from 'react';
import { IonIcon } from '@ionic/react';
import { star, starOutline } from 'ionicons/icons';
import { useLanguage } from '../../../shared/i18n/LanguageContext';
import { useFavoriteCodes } from '../application/useFavorites';
import './favorites.css';

/**
 * Star toggle to save a beach locally. It lives INSIDE clickable rows that
 * navigate on click and on Enter/Space, so both events stop here: saving a
 * favorite must never open the beach.
 */
const FavoriteButton: React.FC<{
  code: string;
  /** Beach name, only for the accessible label. */
  name: string;
  className?: string;
}> = ({ code, name, className }) => {
  const { t } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavoriteCodes();
  const active = isFavorite(code);
  const label = t(active ? 'fav.quitar' : 'fav.marcar', { nombre: name });

  return (
    <button
      type="button"
      className={`fav-btn${active ? ' fav-btn--active' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(code);
      }}
      onKeyDown={(e) => {
        // The row underneath also navigates on these keys.
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <IonIcon icon={active ? star : starOutline} aria-hidden="true" />
    </button>
  );
};

export default FavoriteButton;
