/**
 * Ajoute un espace avant chaque majuscule et met la première lettre
 * de la chaîne en majuscule.
 */
export const formatLabel = (raw: string) =>
	raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
