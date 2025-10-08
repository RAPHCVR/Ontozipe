import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { buildNodeFromUri } from "./queries";
import { Node } from "./result_representation";
import { escapeSparqlLiteral } from "../utils/sparql.utils";
/**
 * Paramètres pour une recherche de noeud avec (ou sans) contraintes.
 * - keywords: liste de mots-clés à rechercher dans l'ontologie
 * - max_results: nombre maximum d'entités à récupérer (limité à [1..50])
 */
export interface NodeRequestParams {
  keywords: string[];
  max_results?: number;
}
/**
 * NodeRequest définit un ensemble de contraintes pour une requête SPARQL.
 * La méthode fetch():
 * 1) construit la requête SPARQL selon les contraintes,
 * 2) l'exécute et récupère les URI des noeuds correspondants (jusqu'à maxResults),
 * 3) pour chaque URI, appelle la fonction buildNodeFromUri du module queries.ts
 *    pour renvoyer une liste d'objets Node entièrement construits.
 *
 * Usage:
 *   const req = new NodeRequest({ keywords: ["autonome", "véhicule"], max_results: 6 });
 *   const nodes = await req.fetch(this.http, this.FUSEKI_SPARQL, onto);
 */
export class NodeRequest {
  public readonly keywords: string[];
  public readonly maxResults: number;
  constructor(params: NodeRequestParams) {
    const k = (params.keywords ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
    if (k.length === 0) {
      throw new Error("NodeRequest: at least one keyword is required.");
    }
    this.keywords = k;
    const rawLimit = params.max_results ?? 10;
    // Clamp limit to [1..50] to avoid abusive queries
    this.maxResults = Math.max(1, Math.min(50, rawLimit));
  }
  /**
   * Crée une requête SPARQL qui cherche les noeuds qui match le plus de mots clés.
   * Les champs pris en compte pour le matching incluent:
   * - URI du noeud (et son nom local),
   * - URI du prédicat,
   * - Valeurs,
   * - rdfs:label, rdfs:comment,
   * en position "subject" ou "object".
   */
  private buildSearchSparql(ontologyIri: string): string {
    const filters = this.keywords
      .map((kwRaw) => {
        const kw = escapeSparqlLiteral(kwRaw.toLowerCase());
        // Egalité exacte pour les mots courts (<= 3 lettres) sinon match partiel.
        const exact = `(
          LCASE(STR(?node)) = "${kw}" ||
          LCASE(STR(?localName)) = "${kw}" ||
          LCASE(STR(?property)) = "${kw}" ||
          LCASE(STR(?value)) = "${kw}" ||
          LCASE(STR(?label)) = "${kw}" ||
          LCASE(STR(?comment)) = "${kw}"
        )`;
        const partial = `(
          CONTAINS(LCASE(STR(?node)), "${kw}") ||
          CONTAINS(LCASE(STR(?localName)), "${kw}") ||
          CONTAINS(LCASE(STR(?property)), "${kw}") ||
          CONTAINS(LCASE(STR(?value)), "${kw}") ||
          CONTAINS(LCASE(STR(?label)), "${kw}") ||
          CONTAINS(LCASE(STR(?comment)), "${kw}")
        )`;
        return kwRaw.length > 3 ? partial : exact;
      })
      .join(" || ");
    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?node (COUNT(DISTINCT ?matchType) AS ?matchCount) WHERE {
        GRAPH <${ontologyIri}> {
          {
            # Node as subject
            ?node ?property ?value .
            OPTIONAL { ?node rdfs:label ?label }
            OPTIONAL { ?node rdfs:comment ?comment }
            BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
            BIND("subject_match" AS ?matchType)
            FILTER(${filters})
          }
          UNION
          {
            # Node as object
            ?subject ?property ?node .
            OPTIONAL { ?node rdfs:label ?label }
            OPTIONAL { ?node rdfs:comment ?comment }
            BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
            BIND("object_match" AS ?matchType)
            FILTER(${filters})
          }
          UNION
          {
            # Labels
            ?node rdfs:label ?label .
            OPTIONAL { ?node rdfs:comment ?comment }
            BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
            BIND("" AS ?property)
            BIND("" AS ?value)
            BIND("label_match" AS ?matchType)
            FILTER(${filters})
          }
          UNION
          {
            # Comments
            ?node rdfs:comment ?comment .
            OPTIONAL { ?node rdfs:label ?label }
            BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
            BIND("" AS ?property)
            BIND("" AS ?value)
            BIND("comment_match" AS ?matchType)
            FILTER(${filters})
          }
          UNION
          {
            # Fallback URI/localName only
            ?node ?anyProp ?anyValue .
            OPTIONAL { ?node rdfs:label ?label }
            OPTIONAL { ?node rdfs:comment ?comment }
            BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
            BIND("" AS ?property)
            BIND("" AS ?value)
            BIND("uri_match" AS ?matchType)
            FILTER(${filters})
          }
        }
      }
      GROUP BY ?node
      HAVING (?matchCount > 0)
      ORDER BY DESC(?matchCount) ?node
      LIMIT ${this.maxResults}
    `;
  }
  /**
   * Exécute la recherche et renvoie les noeuds complets avec buildNodeFromUri.
   *
   * @param http           NestJS HttpService
   * @param fusekiSparqlUrl Fuseki /sparql endpoint URL
   * @param ontologyIri    Target ontology graph IRI
   */
  public async fetch(
    http: HttpService,
    fusekiSparqlUrl: string,
    ontologyIri: string
  ): Promise<Node[]> {
    if (!ontologyIri || ontologyIri.trim().length === 0) {
      throw new Error("NodeRequest.fetch: ontologyIri is required.");
    }
    const sparql = this.buildSearchSparql(ontologyIri);
    const params = new URLSearchParams({
      query: sparql,
      format: "application/sparql-results+json",
    });
    type Binding = {
      node: { value: string };
      matchCount?: { value: string };
    };
    let uris: string[] = [];
    try {
      const res = await lastValueFrom(http.get(fusekiSparqlUrl, { params }));
      const bindings = (res.data?.results?.bindings ?? []) as Binding[];
      uris = bindings.map((b) => b.node.value);
    } catch (err) {
      console.error("[NodeRequest.fetch] SPARQL search error:", err);
      throw new Error("Failed to execute constrained search for NodeRequest.");
    }
    // Déduplique les URI et tronque à maxResults
    const uniqueUris = Array.from(new Set(uris)).slice(0, this.maxResults);
    // Construit les noeuds complets pour chaque URI
    const nodes: Node[] = [];
    for (const uri of uniqueUris) {
      try {
        const node = await buildNodeFromUri(http, fusekiSparqlUrl, ontologyIri, uri);
        nodes.push(node);
      } catch (err) {
        // Ne pas échouer complètement si un noeud pose problème
        console.warn(`[NodeRequest.fetch] Failed to build node for URI <${uri}>:`, err);
      }
    }
    return nodes;
  }
}