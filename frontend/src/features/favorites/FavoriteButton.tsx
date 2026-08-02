import React from 'react';
import { IonIcon } from '@ionic/react';
import { star, starOutline } from 'ionicons/icons';
import { useIdioma } from '../../i18n/IdiomaContext';
import { useFavoritas } from './useFavorites';
import './favorites.css';

/**
 * Star toggle to save a beach locally. It lives INSIDE clickable rows that
 * navigate on click and on Enter/Space, so both events stop here: saving a
 * favorite must never open the beach.
 */
const FavoriteButton: React.FC<{
  codigo: string;
  /** Beach name, only for the accessible label. */
  nombre: string;
  className?: string;
}> = ({ codigo, nombre, className }) => {
  const { t } = useIdioma();
  const { esFavorita, toggleFavorita } = useFavoritas();
  const activa = esFavorita(codigo);
  const etiqueta = t(activa ? 'fav.quitar' : 'fav.marcar', { nombre });

  return (
    <button
      type="button"
      className={`fav-btn${activa ? ' fav-btn--activa' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={activa}
      aria-label={etiqueta}
      title={etiqueta}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorita(codigo);
      }}
      onKeyDown={(e) => {
        // The row underneath also navigates on these keys.
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
      }}
    >
      <IonIcon icon={activa ? star : starOutline} aria-hidden="true" />
    </button>
  );
};

export default FavoriteButton;
