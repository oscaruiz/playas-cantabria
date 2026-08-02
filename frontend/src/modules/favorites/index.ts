/**
 * Favorite beaches — public API of the module.
 *
 * A beach code is all this module knows about a beach: it stores codes, it
 * answers whether a code is saved, and it renders the star. That is why it
 * depends on no other module.
 *
 * Nothing outside `modules/favorites/` imports its internals; the storage
 * format lives in `infrastructure/` and can change without anyone noticing.
 */
export { useFavoritas, toggleFavorita, recargarFavoritas } from './application/useFavorites';
export { default as FavoriteButton } from './ui/FavoriteButton';
