import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";

export interface NodeWithConnectionCount {
    uri: string;
    connectionCount: number;
}

export interface NodeSearchResult {
    uri: string;
    matchedKeywords: number;
}

export interface EntityDetails {
    id: string;
    label?: string;
    types: string[];
    properties: { predicate: string; value: string; isLiteral: boolean }[];
}

export async function getMostConnectedNodes(
    http: HttpService, 
    fusekiSparqlUrl: string, 
    ontologyIri: string
): Promise<NodeWithConnectionCount[]> {
    const sparql = `
        SELECT ?node (COUNT(DISTINCT ?connectedNode) AS ?connectionCount) WHERE {
            GRAPH <${ontologyIri}> {
                {
                    # Nœuds comme sujets
                    ?node ?predicate ?connectedNode .
                    FILTER(isURI(?connectedNode))
                }
                UNION
                {
                    # Nœuds comme objets
                    ?connectedNode ?predicate ?node .
                    FILTER(isURI(?connectedNode))
                }
            }
        }
        GROUP BY ?node
        ORDER BY DESC(?connectionCount)
        LIMIT 10
    `;

    const params = new URLSearchParams({ 
        query: sparql, 
        format: "application/sparql-results+json" 
    });

    const res = await lastValueFrom(http.get(fusekiSparqlUrl, { params }));
    
    type SparqlBinding = {
        node: { value: string };
        connectionCount: { value: string };
    };

    const bindings = res.data.results.bindings as SparqlBinding[];
    
    return bindings.map(binding => ({
        uri: binding.node.value,
        connectionCount: parseInt(binding.connectionCount.value, 10)
    }));
}

export async function searchNodesByKeywords(
    http: HttpService,
    fusekiSparqlUrl: string,
    ontologyIri: string,
    keywords: string[],
    limit: number = 50
): Promise<NodeSearchResult[]> {
    // Construire les conditions de filtrage pour chaque mot-clé
    const filterConditions = keywords.map((keyword, index) => {
        const cleanKeyword = keyword.toLowerCase().trim();
        if (cleanKeyword.length > 3) {
            // Match partiel pour les mots de plus de 3 caractères
            return `(
                CONTAINS(LCASE(STR(?node)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?property)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?value)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?label)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?comment)), "${cleanKeyword}")
            )`;
        } else {
            // Match exact pour les mots courts
            return `(
                STR(?node) = "${cleanKeyword}" ||
                STR(?property) = "${cleanKeyword}" ||
                STR(?value) = "${cleanKeyword}" ||
                STR(?label) = "${cleanKeyword}" ||
                STR(?comment) = "${cleanKeyword}"
            )`;
        }
    }).join(' || ');

    const sparql = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT ?node (COUNT(DISTINCT ?matchedKeyword) AS ?matchCount) WHERE {
            GRAPH <${ontologyIri}> {
                {
                    # Recherche dans les propriétés du nœud (comme sujet)
                    ?node ?property ?value .
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND("dummy" AS ?matchedKeyword)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche dans les relations où le nœud est objet
                    ?subject ?property ?node .
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND("dummy" AS ?matchedKeyword)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche dans les labels et commentaires spécifiquement
                    ?node rdfs:label ?label .
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND("" AS ?property)
                    BIND("" AS ?value)
                    BIND("dummy" AS ?matchedKeyword)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche dans les commentaires spécifiquement
                    ?node rdfs:comment ?comment .
                    OPTIONAL { ?node rdfs:label ?label }
                    BIND("" AS ?property)
                    BIND("" AS ?value)
                    BIND("dummy" AS ?matchedKeyword)
                    FILTER(${filterConditions})
                }
            }
        }
        GROUP BY ?node
        HAVING (?matchCount > 0)
        ORDER BY DESC(?matchCount) ?node
        LIMIT ${limit}
    `;

    const params = new URLSearchParams({ 
        query: sparql, 
        format: "application/sparql-results+json" 
    });

    try {
        const res = await lastValueFrom(http.get(fusekiSparqlUrl, { params }));
        
        type SparqlSearchBinding = {
            node: { value: string };
            matchCount: { value: string };
        };

        const bindings = res.data.results.bindings as SparqlSearchBinding[];
        
        return bindings.map(binding => ({
            uri: binding.node.value,
            matchedKeywords: parseInt(binding.matchCount.value, 10)
        }));
    } catch (error) {
        console.error('Error executing keyword search query:', error);
        throw new Error('Failed to search nodes by keywords');
    }
}

export async function batchGetEntityDetails(
    http: HttpService,
    fusekiSparqlUrl: string,
    ontologyIri: string,
    uris: string[]
): Promise<Map<string, EntityDetails>> {
    if (!uris || uris.length === 0) {
        return new Map();
    }

    // Construire la requête SPARQL pour récupérer les détails de toutes les URIs en une seule fois
    const urisList = uris.map(uri => `<${uri}>`).join(', ');
    
    const sparql = `
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        
        SELECT ?entity ?lbl ?p ?v WHERE {
            GRAPH <${ontologyIri}> {
                VALUES ?entity { ${urisList} }
                OPTIONAL { ?entity rdfs:label ?lbl }
                {
                    ?entity rdf:type ?v .
                    BIND(rdf:type AS ?p)
                }
                UNION
                {
                    ?entity ?p ?v .
                    FILTER(?p != rdfs:label)
                }
            }
        }
        ORDER BY ?entity ?p
    `;

    const params = new URLSearchParams({ 
        query: sparql, 
        format: "application/sparql-results+json" 
    });

    try {
        const res = await lastValueFrom(http.get(fusekiSparqlUrl, { params }));
        
        type SparqlEntityBinding = {
            entity: { value: string };
            lbl?: { value: string };
            p: { value: string };
            v: { value: string; type: string };
        };

        const bindings = res.data.results.bindings as SparqlEntityBinding[];
        
        // Grouper les résultats par entité
        const entitiesMap = new Map<string, EntityDetails>();
        
        for (const binding of bindings) {
            const entityUri = binding.entity.value;
            
            if (!entitiesMap.has(entityUri)) {
                entitiesMap.set(entityUri, {
                    id: entityUri,
                    label: binding.lbl?.value || entityUri.split(/[#/]/).pop(),
                    types: [],
                    properties: []
                });
            }
            
            const entity = entitiesMap.get(entityUri)!;
            
            // Mettre à jour le label si disponible
            if (binding.lbl && !entity.label) {
                entity.label = binding.lbl.value;
            }
            
            if (binding.p.value.endsWith('type')) {
                // C'est un type
                if (!entity.types.includes(binding.v.value)) {
                    entity.types.push(binding.v.value);
                }
            } else {
                // C'est une propriété
                entity.properties.push({
                    predicate: binding.p.value,
                    value: binding.v.value,
                    isLiteral: binding.v.type !== 'uri'
                });
            }
        }
        
        // S'assurer que toutes les URIs demandées sont dans le résultat
        for (const uri of uris) {
            if (!entitiesMap.has(uri)) {
                entitiesMap.set(uri, {
                    id: uri,
                    label: uri.split(/[#/]/).pop(),
                    types: [],
                    properties: []
                });
            }
        }
        
        return entitiesMap;
    } catch (error) {
        console.error('Error executing batch entity details query:', error);
        throw new Error('Failed to get batch entity details');
    }
}