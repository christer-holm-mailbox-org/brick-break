/**
 * config.secrets.example.js – Mall för lokala hemligheter
 *
 * Kopiera den här filen till config.secrets.js (gitignorad, se .gitignore)
 * och fyll i det verkliga värdet nedan. config.secrets.js får ALDRIG
 * committas till git – repot är publikt på GitHub, och SCORE_HMAC_SECRET
 * måste matcha den hemlighet som är satt server-side i Edge Function-
 * miljön (SCORE_HMAC_SECRET), annars nekas alla poänginlämningar.
 */
export const SCORE_HMAC_SECRET = 'REPLACE_ME';
