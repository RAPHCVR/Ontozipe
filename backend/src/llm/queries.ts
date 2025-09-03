import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ResultRepresentation, Node, IAttribute, INodeOptions, IRelationship } from './result_representation'; // Assurez-vous que le chemin est correct


export interface NodeWithConnectionCount {
    uri: string;
    connectionCount: number;
}

export interface NodeSearchResult {
    uri: string;
    matchedKeywords: number;
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
                    # noeuds comme sujets
                    ?node ?predicate ?connectedNode .
                    FILTER(isURI(?connectedNode))
                }
                UNION
                {
                    # noeuds comme objets
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
    // Fonction pour extraire le nom local d'une URI (partie après # ou dernière /)
    const extractLocalName = (uri: string) => {
        const hashIndex = uri.lastIndexOf('#');
        const slashIndex = uri.lastIndexOf('/');
        return uri.substring(Math.max(hashIndex, slashIndex) + 1);
    };

    // Construire les conditions de filtrage pour chaque mot-clé
    const filterConditions = keywords.map(keyword => {
        const cleanKeyword = keyword.toLowerCase().trim();
        if (cleanKeyword.length > 3) {
            // Match partiel pour les mots de plus de 3 caractères
            return `(
                CONTAINS(LCASE(STR(?node)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?localName)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?property)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?value)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?label)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?comment)), "${cleanKeyword}")
            )`;
        } else {
            // Match exact pour les mots courts
            return `(
                LCASE(STR(?node)) = "${cleanKeyword}" ||
                LCASE(STR(?localName)) = "${cleanKeyword}" ||
                LCASE(STR(?property)) = "${cleanKeyword}" ||
                LCASE(STR(?value)) = "${cleanKeyword}" ||
                LCASE(STR(?label)) = "${cleanKeyword}" ||
                LCASE(STR(?comment)) = "${cleanKeyword}"
            )`;
        }
    }).join(' || ');

    const sparql = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT ?node (COUNT(DISTINCT ?matchType) AS ?matchCount) WHERE {
            GRAPH <${ontologyIri}> {
                {
                    # Recherche dans les propriétés du nœud (comme sujet)
                    ?node ?property ?value .
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    # Extraire le nom local de l'URI du nœud
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    BIND("subject_match" AS ?matchType)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche dans les relations où le nœud est objet
                    ?subject ?property ?node .
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    # Extraire le nom local de l'URI du nœud
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    BIND("object_match" AS ?matchType)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche spécifique dans les labels 
                    ?node rdfs:label ?label .
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    BIND("" AS ?property)
                    BIND("" AS ?value)
                    BIND("label_match" AS ?matchType)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche spécifique dans les commentaires
                    ?node rdfs:comment ?comment .
                    OPTIONAL { ?node rdfs:label ?label }
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    BIND("" AS ?property)
                    BIND("" AS ?value)
                    BIND("comment_match" AS ?matchType)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    # Recherche spécifique dans les URI/noms locaux sans autres propriétés
                    ?node ?anyProp ?anyValue .
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND("" AS ?property)
                    BIND("" AS ?value)
                    BIND("uri_match" AS ?matchType)
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

/**
 * Récupère toutes les informations d'un nœud spécifique depuis Fuseki et construit un objet Node complet.
 * @param http Le service HttpService de NestJS.
 * @returns Un objet Node complet et marqué comme 'built'.
 */
export async function buildNodeFromUri(
    http: HttpService,
    fusekiSparqlUrl: string,
    ontologyIri: string,
    nodeUri: string
): Promise<Node> {
    const sparql = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        
        SELECT DISTINCT
          ?nodeLabel
          ?nodeType
          ?property
          ?propertyLabel
          ?value
          ?valueType
          ?valueLabel
          ?literalDatatype
          ?relationDirection
          ?relatedEntity
        WHERE {
            GRAPH <${ontologyIri}> {
                BIND(<${nodeUri}> AS ?subject)
        
                # Récupérer le label et le type du sujet principal
                OPTIONAL { ?subject rdfs:label ?nodeLabel . }
                OPTIONAL { ?subject rdf:type ?nodeType . FILTER(isIRI(?nodeType)) }

                {
                    # Récupérer toutes les propriétés sortantes (node as subject)
                    ?subject ?property ?value .
                    BIND("outgoing" AS ?relationDirection)
                    BIND(?value AS ?relatedEntity)
                } 
                UNION 
                {
                    # Récupérer toutes les propriétés entrantes (node as object)
                    ?relatedEntity ?property ?subject .
                    BIND(?subject AS ?value)
                    BIND("incoming" AS ?relationDirection)
                }
                UNION
                {
                    # Récupérer les classes parentes de son type si le nœud est un individu
                    ?subject rdf:type ?nodeTypeTemp .
                    ?nodeTypeTemp rdfs:subClassOf+ ?value .
                    BIND(<http://www.semanticweb.org/custom/belongsToClass> AS ?property)
                    BIND("outgoing" AS ?relationDirection)  
                    BIND(?value AS ?relatedEntity)
                    FILTER(isIRI(?nodeTypeTemp) && isIRI(?value))
                }
        
                # Blocs optionnels pour enrichir les données
                OPTIONAL { ?property rdfs:label ?propertyLabel . }
                OPTIONAL {
                    FILTER(isIRI(?value))
                    ?value rdfs:label ?valueLabel .
                }
        
                # Blocs BIND pour calculer les discriminateurs
                BIND(IF(isLiteral(?value), "Literal", "URI") AS ?valueType)
                BIND(IF(isLiteral(?value), STR(datatype(?value)), "") AS ?literalDatatype)
            }
        }
    `;

    const params = new URLSearchParams({ 
        query: sparql, 
        format: "application/sparql-results+json" 
    });

    try {
        const res = await lastValueFrom(http.get(fusekiSparqlUrl, { params }));

        type SparqlBinding = {  // Binding de la requête sparql
            nodeLabel?: { value: string };
            nodeType?: { value: string };
            property: { value: string };
            propertyLabel?: { value: string };
            value: { value: string };
            valueType: { value: string };
            valueLabel?: { value: string };
            literalDatatype: { value: string };
            relationDirection?: { value: string };
            relatedEntity?: { value: string };
        };

        const bindings = res.data.results.bindings as SparqlBinding[];

        if (bindings.length === 0) {
            // Si le noeud n'a aucune propriété on le crée quand même.
            // On peut faire une query plus simple pour juste le label/type
            // mais pour l'instant on retourne un noeud minimal.
            console.warn(`Node with URI <${nodeUri}> not found or has no properties.`);
            return new Node({ uri: nodeUri });
        }
        
        // Initialisation des collections pour le nouveau noeud avec des Sets pour éviter les doublons
        const attributesSet = new Map<string, IAttribute>(); // Key: property_uri + value
        const relationshipsSet = new Map<string, IRelationship>(); // Key: target_uri + predicate_uri + direction
        let nodeLabel = bindings[0].nodeLabel?.value;
        let nodeType = bindings[0].nodeType?.value;

        // Perrmet d'obtenir un nom lisible à partir de l'URI
        const getLocalName = (uri: string) => uri.substring(uri.lastIndexOf('#') + 1);

        for (const binding of bindings) {
            // Le label et le type peuvent être répétés sur chaque ligne, on les prend une fois.
            if (!nodeLabel && binding.nodeLabel) nodeLabel = binding.nodeLabel.value;
            if (!nodeType && binding.nodeType) nodeType = binding.nodeType.value;

            // On ignore le triplet rdf:type ici car on le gère déjà via la variable nodeType.
            if (binding.property.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
                continue;
            }
            
            if (binding.valueType.value === 'Literal') {
                // C'est un ATTRIBUT (seulement pour les relations sortantes)
                if (binding.relationDirection?.value === 'outgoing') {
                    const attribute: IAttribute = {
                        property_uri: binding.property.value,
                        property_label: binding.propertyLabel?.value || getLocalName(binding.property.value),
                        value: binding.value.value,
                        datatype: binding.literalDatatype.value
                    };
                    // Clé unique pour éviter les doublons
                    const attributeKey = `${attribute.property_uri}:${attribute.value}:${attribute.datatype}`;
                    attributesSet.set(attributeKey, attribute);
                }
            } else { // 'URI'
                // C'est une RELATION
                const direction = binding.relationDirection?.value as 'outgoing' | 'incoming';
                const targetUri = direction === 'outgoing' ? binding.value.value : binding.relatedEntity?.value;
                
                if (targetUri) {
                    let predicateLabel = binding.propertyLabel?.value || getLocalName(binding.property.value);
                    
                    // Gestion spéciale pour les relations de classe
                    if (binding.property.value === 'http://www.w3.org/2000/01/rdf-schema#subClassOf') {
                        predicateLabel = 'sous-classe de';
                    } else if (binding.property.value === 'http://www.semanticweb.org/custom/belongsToClass') {
                        predicateLabel = 'appartient à la classe';
                    }
                    
                    const relationship: IRelationship = {
                        target_uri: targetUri,
                        predicate_uri: binding.property.value,
                        predicate_label: predicateLabel,
                        direction: direction
                    };
                    // Utiliser une clé unique pour éviter les doublons de relations
                    const relationshipKey = `${relationship.target_uri}:${relationship.predicate_uri}:${relationship.direction}`;
                    relationshipsSet.set(relationshipKey, relationship);
                }
            }
        }

        // Convertir les Maps en Arrays
        const attributes = Array.from(attributesSet.values());
        const relationships = Array.from(relationshipsSet.values());
        
        // Construction de l'objet Node final
        const nodeOptions: INodeOptions = {
            uri: nodeUri,
            label: nodeLabel || getLocalName(nodeUri), // Fallback sur le nom local
            node_type: nodeType, // Peut être undefined si non trouvé
            attributes: attributes,
            relationships: relationships
        };

        return new Node(nodeOptions);

    } catch (error) {
        console.error(`Error building node from URI <${nodeUri}>:`, error);
        throw new Error(`Failed to build node from URI`);
    }
}
