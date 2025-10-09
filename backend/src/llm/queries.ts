
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { ResultRepresentation, Node, IAttribute, INodeOptions, IRelationship } from './result_representation';

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
                    ?node ?predicate ?connectedNode .
                    FILTER(isURI(?connectedNode))
                }
                UNION
                {
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
    const extractLocalName = (uri: string) => {
        const hashIndex = uri.lastIndexOf('#');
        const slashIndex = uri.lastIndexOf('/');
        return uri.substring(Math.max(hashIndex, slashIndex) + 1);
    };

    const filterConditions = keywords.map(keyword => {
        const cleanKeyword = keyword.toLowerCase().trim();
        if (cleanKeyword.length > 3) {
            return `(
                CONTAINS(LCASE(STR(?node)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?localName)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?property)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?value)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?label)), "${cleanKeyword}") ||
                CONTAINS(LCASE(STR(?comment)), "${cleanKeyword}")
            )`;
        } else {
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
                    ?node ?property ?value .
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    BIND("subject_match" AS ?matchType)
                    FILTER(${filterConditions})
                }
                UNION
                {
                    ?subject ?property ?node .
                    OPTIONAL { ?node rdfs:label ?label }
                    OPTIONAL { ?node rdfs:comment ?comment }
                    BIND(REPLACE(STR(?node), "^.*[/#]([^/#]+)$", "$1") AS ?localName)
                    BIND("object_match" AS ?matchType)
                    FILTER(${filterConditions})
                }
                UNION
                {
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
                OPTIONAL { ?subject rdfs:label ?nodeLabel . }
                OPTIONAL { ?subject rdf:type ?nodeType . FILTER(isIRI(?nodeType)) }

                {
                    ?subject ?property ?value .
                    BIND("outgoing" AS ?relationDirection)
                    BIND(?value AS ?relatedEntity)
                }
                UNION
                {
                    ?relatedEntity ?property ?subject .
                    BIND(?subject AS ?value)
                    BIND("incoming" AS ?relationDirection)
                }
                UNION
                {
                    ?subject rdf:type ?nodeTypeTemp .
                    ?nodeTypeTemp rdfs:subClassOf+ ?value .
                    BIND(<http://www.semanticweb.org/custom/belongsToClass> AS ?property)
                    BIND("outgoing" AS ?relationDirection)  
                    BIND(?value AS ?relatedEntity)
                    FILTER(isIRI(?nodeTypeTemp) && isIRI(?value))
                }

                OPTIONAL { ?property rdfs:label ?propertyLabel . }
                OPTIONAL {
                    FILTER(isIRI(?value))
                    ?value rdfs:label ?valueLabel .
                }

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
        type SparqlBinding = {
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
            console.warn(`Node with URI <${nodeUri}> not found or has no properties.`);
            return new Node({ uri: nodeUri });
        }

        const attributesSet = new Map<string, IAttribute>();
        const relationshipsSet = new Map<string, IRelationship>();
        let nodeLabel = bindings[0].nodeLabel?.value;
        let nodeType = bindings[0].nodeType?.value;

        const getLocalName = (uri: string) => uri.substring(Math.max(uri.lastIndexOf('#'), uri.lastIndexOf('/')) + 1);

        for (const binding of bindings) {
            if (!nodeLabel && binding.nodeLabel) nodeLabel = binding.nodeLabel.value;
            if (!nodeType && binding.nodeType) nodeType = binding.nodeType.value;

            if (binding.property.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
                continue;
            }

            if (binding.valueType.value === 'Literal') {
                if (binding.relationDirection?.value === 'outgoing') {
                    const attribute: IAttribute = {
                        property_uri: binding.property.value,
                        property_label: binding.propertyLabel?.value || getLocalName(binding.property.value),
                        value: binding.value.value,
                        datatype: binding.literalDatatype.value
                    };
                    const attributeKey = `${attribute.property_uri}:${attribute.value}:${attribute.datatype}`;
                    attributesSet.set(attributeKey, attribute);
                }
            } else {
                const direction = binding.relationDirection?.value as 'outgoing' | 'incoming';
                const targetUri = direction === 'outgoing' ? binding.value.value : binding.relatedEntity?.value;
                if (targetUri) {
                    let predicateLabel = binding.propertyLabel?.value || getLocalName(binding.property.value);
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
                    const relationshipKey = `${relationship.target_uri}:${relationship.predicate_uri}:${relationship.direction}`;
                    relationshipsSet.set(relationshipKey, relationship);
                }
            }
        }

        const attributes = Array.from(attributesSet.values());
        const relationships = Array.from(relationshipsSet.values());

        const nodeOptions: INodeOptions = {
            uri: nodeUri,
            label: nodeLabel || getLocalName(nodeUri),
            node_type: nodeType,
            attributes: attributes,
            relationships: relationships
        };
        return new Node(nodeOptions);
    } catch (error) {
        console.error(`Error building node from URI <${nodeUri}>:`, error);
        throw new Error('Failed to build node from URI');
    }
}

/**
* Récupère toutes les informations pour plusieurs nœuds (URIs) en une seule requête SPARQL.
*/
export async function buildNodesFromUris(
    http: HttpService,
    fusekiSparqlUrl: string,
    ontologyIri: string,
    nodeUris: string[]
): Promise<Node[]> {
    const uris = Array.from(new Set(nodeUris.filter(Boolean)));
    if (uris.length === 0) return [];

    const values = uris.map(u => `<${u}>`).join(' ');
    const sparql = `
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
        SELECT DISTINCT
          ?subject
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
                VALUES ?subject { ${values} }

                OPTIONAL { ?subject rdfs:label ?nodeLabel . }
                OPTIONAL { ?subject rdf:type ?nodeType . FILTER(isIRI(?nodeType)) }

                OPTIONAL {
                    {
                        ?subject ?property ?value .
                        BIND("outgoing" AS ?relationDirection)
                        BIND(?value AS ?relatedEntity)
                    }
                    UNION
                    {
                        ?relatedEntity ?property ?subject .
                        BIND(?subject AS ?value)
                        BIND("incoming" AS ?relationDirection)
                    }
                    UNION
                    {
                        ?subject rdf:type ?nodeTypeTemp .
                        ?nodeTypeTemp rdfs:subClassOf+ ?value .
                        BIND(<http://www.semanticweb.org/custom/belongsToClass> AS ?property)
                        BIND("outgoing" AS ?relationDirection)
                        BIND(?value AS ?relatedEntity)
                        FILTER(isIRI(?nodeTypeTemp) && isIRI(?value))
                    }
                }

                OPTIONAL { ?property rdfs:label ?propertyLabel . }
                OPTIONAL { FILTER(isIRI(?value)) ?value rdfs:label ?valueLabel . }

                BIND(
                    IF(BOUND(?value) && isLiteral(?value), "Literal",
                        IF(BOUND(?value), "URI", "")
                    ) AS ?valueType
                )
                BIND(
                    IF(BOUND(?value) && isLiteral(?value), STR(datatype(?value)), "") AS ?literalDatatype
                )
            }
        }
    `;

    const params = new URLSearchParams({ query: sparql, format: "application/sparql-results+json" });
    const res = await lastValueFrom(http.get(fusekiSparqlUrl, { params }));

    type Row = {
        subject: { value: string };
        nodeLabel?: { value: string };
        nodeType?: { value: string };
        property?: { value: string };
        propertyLabel?: { value: string };
        value?: { value: string };
        valueType?: { value: string };
        valueLabel?: { value: string };
        literalDatatype?: { value: string };
        relationDirection?: { value: string };
        relatedEntity?: { value: string };
    };

    const rows = res.data.results.bindings as Row[];
    const bySubject = new Map<string, {
        uri: string;
        label?: string;
        nodeType?: string;
        attributes: Map<string, IAttribute>;
        relationships: Map<string, IRelationship>;
    }>();

    const getLocalName = (uri: string) => uri.substring(Math.max(uri.lastIndexOf('#'), uri.lastIndexOf('/')) + 1);

    // Même si aucune relation n'est trouvée, initialise les Maps.
    for (const uri of uris) {
        bySubject.set(uri, {
            uri,
            attributes: new Map(),
            relationships: new Map()
        });
    }

    for (const b of rows) {
        const s = b.subject.value;
        const agg = bySubject.get(s)!;

        if (!agg.label && b.nodeLabel) agg.label = b.nodeLabel.value;
        if (!agg.nodeType && b.nodeType) agg.nodeType = b.nodeType.value;

        // Passe si il manque des champs essentiels
        if (!b.property || !b.valueType || !b.relationDirection) continue;

        // Passe si triplet rdf:type car déjà géré (à l'échelle de la Node)
        if (b.property.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') continue;

        if (b.valueType.value === "Literal") {
            if (b.relationDirection.value === "outgoing" && b.value && b.literalDatatype) {
                const attr: IAttribute = {
                    property_uri: b.property.value,
                    property_label: b.propertyLabel?.value || getLocalName(b.property.value),
                    value: b.value.value,
                    datatype: b.literalDatatype.value
                };
                const key = `${attr.property_uri}:${attr.value}:${attr.datatype}`;
                agg.attributes.set(key, attr);
            }
        } else if (b.valueType.value === "URI") {
            const direction = b.relationDirection.value as "incoming" | "outgoing";
            const targetUri = direction === "outgoing" ? b.value?.value : b.relatedEntity?.value;
            if (targetUri) {
                let predicateLabel = b.propertyLabel?.value || getLocalName(b.property.value);
                if (b.property.value === 'http://www.w3.org/2000/01/rdf-schema#subClassOf') {
                    predicateLabel = 'sous-classe de';
                } else if (b.property.value === 'http://www.semanticweb.org/custom/belongsToClass') {
                    predicateLabel = 'appartient à';
                }
                const rel: IRelationship = {
                    target_uri: targetUri,
                    predicate_uri: b.property.value,
                    predicate_label: predicateLabel,
                    direction
                };
                const key = `${rel.target_uri}:${rel.predicate_uri}:${rel.direction}`;
                agg.relationships.set(key, rel);
            }
        }
    }

    const result: Node[] = [];
    for (const agg of bySubject.values()) {
        const nodeOptions: INodeOptions = {
            uri: agg.uri,
            label: agg.label || getLocalName(agg.uri),
            node_type: agg.nodeType,
            attributes: Array.from(agg.attributes.values()),
            relationships: Array.from(agg.relationships.values())
        };
        result.push(new Node(nodeOptions));
    }

    return result;
}