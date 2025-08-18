/**
 * Échappe une chaîne de caractères pour l'utiliser en toute sécurité comme littéral
 * dans une requête SPARQL.
 *
 * @param value La chaîne de caractères à échapper.
 * @returns La chaîne de caractères échappée, prête à être insérée dans un littéral SPARQL (entre `"""..."""`).
 */
export function escapeSparqlLiteral(value: unknown): string {
    if (typeof value !== 'string') {
        // Retourne une chaîne vide pour les types non-string afin d'éviter les erreurs.
        return '';
    }
    // Échappe les antislashs puis les guillemets doubles.
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}