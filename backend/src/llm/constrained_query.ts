import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { buildNodeFromUri } from "./queries";
import { Node } from "./result_representation";
import { escapeSparqlLiteral } from "../utils/sparql.utils";

export type RelationDirection = "incoming" | "outgoing" | "both";

export interface RelationFilter {
  predicate: string;                  // Predicate IRI
  direction?: RelationDirection;      // Default "both"
  present: boolean;                   // true => require it, false => require absence
  object_uris?: string[];             // Counterpart URIs filter (outgoing => objects, incoming => subjects)
}

export interface RelationNameFilter {
  name: string;                       // Predicate name (partial allowed, case/space-insensitive)
  direction?: RelationDirection;      // Default "both"
  present?: boolean;                  // true => require it (default), false => require absence
}

/**
* Paramètres pour une recherche de noeud avec (ou sans) contraintes.
* - keywords?: liste de mots-clés à rechercher dans l'ontologie (optionnel)
* - uris?: liste d'URIs à inclure directement dans les résultats (optionnel)
* - object_uris?: retourne les sujets ?node tels que ?node ?p ?o et ?o est dans cette liste (optionnel)
* - relation_filters?: contraintes d'existence/absence de prédicats (optionnel)
* - type_name_patterns?: n'extraire que les noeuds ayant ces rdf:type (nom partiel, AND) (optionnel)
* - relation_name_filters?: contraintes sur le nom (partiel) du prédicat (optionnel)
* - max_results?: borne supérieure (1..50)
*/
export interface NodeRequestParams {
  keywords?: string[];
  uris?: string[];
  object_uris?: string[];
  relation_filters?: RelationFilter[];
  type_name_patterns?: string[];
  relation_name_filters?: RelationNameFilter[];
  max_results?: number;
}

/**
* NodeRequest définit un ensemble de contraintes pour une requête SPARQL.
* La méthode fetch():
* 1) construit la requête SPARQL selon les contraintes,
* 2) l'exécute et récupère les URI des noeuds correspondants (jusqu'à maxResults),
* 3) pour chaque URI, appelle buildNodeFromUri (queries.ts).
*
* Usage:
*   const req = new NodeRequest({
*     keywords: ["développé par", "capteur"],
*     relation_filters: [{ predicate: "http://example.com/développéPar", direction: "outgoing", present: true }],
*     object_uris: ["http://www.semanticweb.org/maherzizouni/ontologies/2024/11/va#Luminar"],
*     type_name_patterns: ["Vehicle", "Sensor"],
*     relation_name_filters: [{ name: "ownedBy", direction: "both", present: true }],
*     max_results: 10
*   });
*   const nodes = await req.fetch(this.http, this.FUSEKI_SPARQL, onto);
*/
export class NodeRequest {
  public readonly keywords: string[];
  public readonly directUris: string[];
  public readonly objectUris: string[];
  public readonly relationFilters: RelationFilter[];
  public readonly typeNamePatterns: string[];
  public readonly relationNameFilters: RelationNameFilter[];
  public readonly maxResults: number;

  constructor(params: NodeRequestParams) {
    const k = (params.keywords ?? [])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const uris = Array.from(
      new Set((params.uris ?? []).map((s) => s.trim()).filter((s) => s.length > 0))
    );

    const objUris = Array.from(
      new Set((params.object_uris ?? []).map((s) => s.trim()).filter((s) => s.length > 0))
    );

    const relFilters = (params.relation_filters ?? []).filter(
      (rf) => typeof rf?.predicate === "string" && rf.predicate.trim().length > 0
    ).map((rf) => ({
      predicate: rf.predicate.trim(),
      direction: (rf.direction ?? "both") as RelationDirection,
      present: !!rf.present,
      object_uris: Array.from(new Set((rf.object_uris ?? []).map((s) => s.trim()).filter(Boolean))),
    }));

    const typePatterns = Array.from(
      new Set((params.type_name_patterns ?? []).map((s) => s.trim()).filter((s) => s.length > 0))
    );

    const relNameFilters = (params.relation_name_filters ?? [])
      .filter((r) => typeof r?.name === "string" && r.name.trim().length > 0)
      .map((r) => ({
        name: r.name.trim(),
        direction: (r.direction ?? "both") as RelationDirection,
        present: r.present === undefined ? true : !!r.present,
      }));

    // At least one criterion is required (keywords OR uris OR object_uris OR relation_filters OR type_name_patterns OR relation_name_filters)
    if (
      k.length === 0 &&
      uris.length === 0 &&
      objUris.length === 0 &&
      relFilters.length === 0 &&
      typePatterns.length === 0 &&
      relNameFilters.length === 0
    ) {
      throw new Error("NodeRequest: at least one criterion is required (keywords, uris, object_uris, relation_filters, type_name_patterns or relation_name_filters).");
    }

    this.keywords = k;
    this.directUris = uris;
    this.objectUris = objUris;
    this.relationFilters = relFilters;
    this.typeNamePatterns = typePatterns;
    this.relationNameFilters = relNameFilters;

    const rawLimit = params.max_results ?? 10;
    this.maxResults = Math.max(1, Math.min(50, rawLimit));
  }

  private buildKeywordFilterClause(): { clause: string; hasAny: boolean } {
    if (this.keywords.length === 0) return { clause: "", hasAny: false };
    // Normalize keywords: lowercase and "flat" (remove spaces/_/-)
    const norm = (s: string) => s.toLowerCase();
    const flat = (s: string) => s.toLowerCase().replace(/[\s_\-]+/g, "");
    const clauses: string[] = [];
    for (const raw of this.keywords) {
      const kwLc = escapeSparqlLiteral(norm(raw));
      const kwFlat = escapeSparqlLiteral(flat(raw));
      const lcFields = [
        "?nodeLc", "?localLc", "?propStrLc", "?propLocalLc", "?valueLc", "?labelLc", "?commentLc"
      ];
      const flatFields = [
        "?nodeFlat", "?localFlat", "?propStrFlat", "?propLocalFlat", "?valueFlat", "?labelFlat", "?commentFlat"
      ];
      const lcCond =
        raw.length > 3
          ? lcFields.map((f) => `CONTAINS(${f}, "${kwLc}")`).join(" || ")
          : lcFields.map((f) => `${f} = "${kwLc}"`).join(" || ");
      const flatCond =
        raw.length > 3
          ? flatFields.map((f) => `CONTAINS(${f}, "${kwFlat}")`).join(" || ")
          : flatFields.map((f) => `${f} = "${kwFlat}"`).join(" || ");
      clauses.push(`( (${lcCond}) || (${flatCond}) )`);
    }
    // Match any keyword (OR). We will count how many matchTypes contributed for ranking.
    return { clause: clauses.join(" || "), hasAny: true };
  }

  private buildRelationFiltersClauses(): string {
    if (this.relationFilters.length === 0) return "";
    const blocks: string[] = [];
    let idx = 0;
    for (const rf of this.relationFilters) {
      const pIri = `<${rf.predicate}>`;
      const dir = rf.direction ?? "both";
      const varTag = `__rf${idx}`;
      const objVar = `?__obj_${varTag}`;
      const subjVar = `?__subj_${varTag}`;
      const outgoingObjectValues =
        rf.object_uris && rf.object_uris.length > 0
          ? `VALUES ${objVar} { ${rf.object_uris.map((u) => ` <${u}>`).join(" ")} }`
          : "";
      const incomingSubjectValues =
        rf.object_uris && rf.object_uris.length > 0
          ? `VALUES ${subjVar} { ${rf.object_uris.map((u) => ` <${u}>`).join(" ")} }`
          : "";
      // Patterns per direction
      const outgoingPattern = `
        {
          ${outgoingObjectValues}
          ?node ${pIri} ${rf.object_uris && rf.object_uris.length > 0 ? objVar : `?__o_${varTag}`} .
        }
      `.trim();
      const incomingPattern = `
        {
          ${incomingSubjectValues}
          ${subjVar} ${pIri} ?node .
        }
      `.trim();
      const dirPattern =
        dir === "outgoing"
          ? outgoingPattern
          : dir === "incoming"
          ? incomingPattern
          : `{ ${outgoingPattern} UNION ${incomingPattern} }`;
      blocks.push(
        rf.present ? `FILTER EXISTS { ${dirPattern} }` : `FILTER NOT EXISTS { ${dirPattern} }`
      );
      idx += 1;
    }
    return blocks.join("\n");
  }

  private buildTypeNameFiltersClauses(): string {
    if (this.typeNamePatterns.length === 0) return "";
    const blocks: string[] = [];
    let idx = 0;
    for (const raw of this.typeNamePatterns) {
      const kwLc = escapeSparqlLiteral(raw.toLowerCase());
      const kwFlat = escapeSparqlLiteral(raw.toLowerCase().replace(/[\s_\-]+/g, ""));
      const tag = `__t${idx}`;
      const strLc = `?${tag}_str_lc`;
      const localLc = `?${tag}_local_lc`;
      const label = `?${tag}_label`;
      const labelLc = `?${tag}_label_lc`;
      const strFlat = `?${tag}_str_flat`;
      const localFlat = `?${tag}_local_flat`;
      const labelFlat = `?${tag}_label_flat`;

      const lcTargets = [localLc, labelLc, strLc];
      const flatTargets = [localFlat, labelFlat, strFlat];

      const lcCond =
        raw.length > 3
          ? lcTargets.map((v) => `CONTAINS(${v}, "${kwLc}")`).join(" || ")
          : lcTargets.map((v) => `${v} = "${kwLc}"`).join(" || ");
      const flatCond =
        raw.length > 3
          ? flatTargets.map((v) => `CONTAINS(${v}, "${kwFlat}")`).join(" || ")
          : flatTargets.map((v) => `${v} = "${kwFlat}"`).join(" || ");

      const pattern = `
        ?node rdf:type ?${tag} .
        OPTIONAL { ?${tag} rdfs:label ${label} }
        BIND(LCASE(STR(?${tag})) AS ${strLc})
        BIND(REPLACE(${strLc}, "^.*[/#]([^/#]+)$", "$1") AS ${localLc})
        BIND(LCASE(STR(COALESCE(${label}, ""))) AS ${labelLc})
        BIND(REPLACE(${strLc}, "[ _-]+", "") AS ${strFlat})
        BIND(REPLACE(${localLc}, "[ _-]+", "") AS ${localFlat})
        BIND(REPLACE(${labelLc}, "[ _-]+", "") AS ${labelFlat})
        FILTER( (${lcCond}) || (${flatCond}) )
      `.trim();

      blocks.push(`FILTER EXISTS { ${pattern} }`);
      idx += 1;
    }
    return blocks.join("\n");
  }

  private buildRelationNameFiltersClauses(): string {
    if (this.relationNameFilters.length === 0) return "";
    const blocks: string[] = [];
    let idx = 0;
    for (const rf of this.relationNameFilters) {
      const raw = rf.name;
      const kwLc = escapeSparqlLiteral(raw.toLowerCase());
      const kwFlat = escapeSparqlLiteral(raw.toLowerCase().replace(/[\s_\-]+/g, ""));
      const tag = `__rnf${idx}`;
      const p = `?${tag}_p`;
      const pLabel = `?${tag}_p_label`;
      const pStrLc = `?${tag}_p_str_lc`;
      const pLocalLc = `?${tag}_p_local_lc`;
      const pLabelLc = `?${tag}_p_label_lc`;
      const pStrFlat = `?${tag}_p_str_flat`;
      const pLocalFlat = `?${tag}_p_local_flat`;
      const pLabelFlat = `?${tag}_p_label_flat`;

      const lcTargets = [pLocalLc, pLabelLc, pStrLc];
      const flatTargets = [pLocalFlat, pLabelFlat, pStrFlat];

      const lcCond =
        raw.length > 3
          ? lcTargets.map((v) => `CONTAINS(${v}, "${kwLc}")`).join(" || ")
          : lcTargets.map((v) => `${v} = "${kwLc}"`).join(" || ");
      const flatCond =
        raw.length > 3
          ? flatTargets.map((v) => `CONTAINS(${v}, "${kwFlat}")`).join(" || ")
          : flatTargets.map((v) => `${v} = "${kwFlat}"`).join(" || ");

      const commonBinds = `
        OPTIONAL { ${p} rdfs:label ${pLabel} }
        BIND(LCASE(STR(${p})) AS ${pStrLc})
        BIND(REPLACE(${pStrLc}, "^.*[/#]([^/#]+)$", "$1") AS ${pLocalLc})
        BIND(LCASE(STR(COALESCE(${pLabel}, ""))) AS ${pLabelLc})
        BIND(REPLACE(${pStrLc}, "[ _-]+", "") AS ${pStrFlat})
        BIND(REPLACE(${pLocalLc}, "[ _-]+", "") AS ${pLocalFlat})
        BIND(REPLACE(${pLabelLc}, "[ _-]+", "") AS ${pLabelFlat})
        FILTER( (${lcCond}) || (${flatCond}) )
      `.trim();

      const outgoingPattern = `
        {
          ?node ${p} ?${tag}_o .
          ${commonBinds}
        }
      `.trim();

      const incomingPattern = `
        {
          ?${tag}_s ${p} ?node .
          ${commonBinds}
        }
      `.trim();

      const dir = rf.direction ?? "both";
      const dirPattern =
        dir === "outgoing"
          ? outgoingPattern
          : dir === "incoming"
          ? incomingPattern
          : `{ ${outgoingPattern} UNION ${incomingPattern} }`;

      blocks.push(
        rf.present === false
          ? `FILTER NOT EXISTS { ${dirPattern} }`
          : `FILTER EXISTS { ${dirPattern} }`
      );
      idx += 1;
    }
    return blocks.join("\n");
  }

  private buildSearchSparql(ontologyIri: string): string {
    const { clause: keywordFilter, hasAny: hasKeywords } = this.buildKeywordFilterClause();
    // Seed blocks - at least one must exist, else we will use a fallback when only relation filters are specified
    const seedBlocks: string[] = [];
    // 1) Direct URIs
    if (this.directUris.length > 0) {
      const values = this.directUris.map((u) => `<${u}>`).join(" ");
      seedBlocks.push(`
        {
          VALUES ?node { ${values} }
          BIND("seed_uri" AS ?matchType)
        }
      `);
    }
    // 2) object_uris => find subjects pointing to any given object
    if (this.objectUris.length > 0) {
      const values = this.objectUris.map((u) => `<${u}>`).join(" ");
      seedBlocks.push(`
        {
          ?node ?_p_obj ?_o_obj .
          VALUES ?_o_obj { ${values} }
          BIND("seed_object" AS ?matchType)
        }
      `);
    }
    // 3) Keywords blocks (subject/object/label/comment/uri)
    if (hasKeywords) {
      const normalizationBinds = `
        # Lower-cased string forms
        BIND(LCASE(STR(?node)) AS ?nodeLc)
        BIND(REPLACE(?nodeLc, "^.*[/#]([^/#]+)$", "$1") AS ?localLc)
        BIND(LCASE(STR(COALESCE(?property, ""))) AS ?propStrLc)
        BIND(REPLACE(?propStrLc, "^.*[/#]([^/#]+)$", "$1") AS ?propLocalLc)
        BIND(LCASE(STR(COALESCE(?value, ""))) AS ?valueLc)
        BIND(LCASE(STR(COALESCE(?label, ""))) AS ?labelLc)
        BIND(LCASE(STR(COALESCE(?comment, ""))) AS ?commentLc)
        # Flattened forms (remove spaces, underscores, hyphens) — no backslash escapes here
        BIND(REPLACE(?nodeLc, "[ _-]+", "") AS ?nodeFlat)
        BIND(REPLACE(?localLc, "[ _-]+", "") AS ?localFlat)
        BIND(REPLACE(?propStrLc, "[ _-]+", "") AS ?propStrFlat)
        BIND(REPLACE(?propLocalLc, "[ _-]+", "") AS ?propLocalFlat)
        BIND(REPLACE(?valueLc, "[ _-]+", "") AS ?valueFlat)
        BIND(REPLACE(?labelLc, "[ _-]+", "") AS ?labelFlat)
        BIND(REPLACE(?commentLc, "[ _-]+", "") AS ?commentFlat)
        `;
      // Subject branch
      seedBlocks.push(`
        {
          ?node ?property ?value .
          OPTIONAL { ?node rdfs:label ?label }
          OPTIONAL { ?node rdfs:comment ?comment }
          ${normalizationBinds}
          FILTER(${keywordFilter})
          BIND("subject_match" AS ?matchType)
        }
      `);
      // Object branch
      seedBlocks.push(`
        {
          ?subject ?property ?node .
          OPTIONAL { ?node rdfs:label ?label }
          OPTIONAL { ?node rdfs:comment ?comment }
          BIND("" AS ?value) # ensures ?valueLc and ?valueFlat are bound to ""
          ${normalizationBinds}
          FILTER(${keywordFilter})
          BIND("object_match" AS ?matchType)
        }
      `);
      // Label branch
      seedBlocks.push(`
        {
          ?node rdfs:label ?label .
          OPTIONAL { ?node rdfs:comment ?comment }
          BIND("" AS ?property)
          BIND("" AS ?value)
          ${normalizationBinds}
          FILTER(${keywordFilter})
          BIND("label_match" AS ?matchType)
        }
      `);
      // Comment branch
      seedBlocks.push(`
        {
          ?node rdfs:comment ?comment .
          OPTIONAL { ?node rdfs:label ?label }
          BIND("" AS ?property)
          BIND("" AS ?value)
          ${normalizationBinds}
          FILTER(${keywordFilter})
          BIND("comment_match" AS ?matchType)
        }
      `);
      // URI/localName-only branch (fallback)
      seedBlocks.push(`
        {
          ?node ?anyProp ?anyValue .
          OPTIONAL { ?node rdfs:label ?label }
          OPTIONAL { ?node rdfs:comment ?comment }
          BIND("" AS ?property)
          BIND("" AS ?value)
          ${normalizationBinds}
          FILTER(${keywordFilter})
          BIND("uri_match" AS ?matchType)
        }
      `);
    }
    // 4) Fallback when you only specified relation filters (no seeds nor keywords):
    const onlyRelationFilters =
      seedBlocks.length === 0 &&
      this.relationFilters.length > 0 &&
      !hasKeywords;
    if (onlyRelationFilters) {
      seedBlocks.push(`
        {
          { ?node ?__p_any ?__v_any } UNION { ?__s_any ?__p_any ?node }
          BIND("any" AS ?matchType)
        }
      `);
    }
    // Safety: if still no seedBlocks (should not happen), add a small generic enumerator
    if (seedBlocks.length === 0) {
      seedBlocks.push(`
        {
          ?node ?__p_any ?__v_any .
          BIND("any" AS ?matchType)
        }
      `);
    }

    const relationClause = this.buildRelationFiltersClauses();
    const relationNameClause = this.buildRelationNameFiltersClauses();
    const typeNameClause = this.buildTypeNameFiltersClauses();

    // Final SPARQL: rank by matchCount when available; otherwise by URI.
    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      SELECT ?node (COUNT(DISTINCT ?matchType) AS ?matchCount) WHERE {
        GRAPH <${ontologyIri}> {
          { ${seedBlocks.join(" } UNION { ")} }
          ${relationClause}
          ${relationNameClause}
          ${typeNameClause}
        }
      }
      GROUP BY ?node
      ORDER BY DESC(?matchCount) ?node
      LIMIT ${this.maxResults}
    `;
  }

  /**
   * Exécute la recherche et renvoie les noeuds complets avec buildNodeFromUri.
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
    // Deduplicate and truncate
    const uniqueUris = Array.from(new Set(uris)).slice(0, this.maxResults);
    // Build full nodes
    const nodes: Node[] = [];
    for (const uri of uniqueUris) {
      try {
        const node = await buildNodeFromUri(http, fusekiSparqlUrl, ontologyIri, uri);
        nodes.push(node);
      } catch (err) {
        console.warn(`[NodeRequest.fetch] Failed to build node for URI <${uri}>:`, err);
      }
    }
    return nodes;
  }
}
