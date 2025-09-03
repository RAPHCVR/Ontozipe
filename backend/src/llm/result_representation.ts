
const defaultLifespan = 5;

/**
 * Représente les attributs (triplets qui contiennent une value type literal)
 */
export interface IAttribute {
    readonly property_uri: string;  // URI de la propriété (ex: "http://example.org/name")
    readonly property_label: string;  // Label lisible de la propriété (ex: "a pour nom")
    readonly value: string;  // Value réelle (brute, par exemple une URL)
    readonly parsed_value?: string;  // Value interprétée (par exemple, un résumé de page web)
    readonly datatype: string;
}

/**
 * Représente une relation avec une autre entité
 */
export interface IRelationship {
    readonly target_uri: string;  // URI de l'entité cible
    readonly predicate_uri: string;  // URI de la propriété/relation
    readonly predicate_label: string;  // Label lisible de la relation (ex: "companyOf", "hasEmployee")
    readonly direction: 'outgoing' | 'incoming';  // Direction de la relation
}

/**
 * Objet option pour le constructeur.
 */
export interface INodeOptions {
    readonly uri: string;
    readonly label?: string;
    readonly node_type?: string;
    readonly attributes?: IAttribute[];
    readonly relationships?: IRelationship[];
    readonly lifespan?: number;
}

/**
 * Contient les informations d'un individu de l'ontologie.
 */
export class Node {
    public readonly uri: string;
    public readonly label?: string;
    public readonly node_type?: string;
    public readonly attributes: IAttribute[];
    public readonly relationships: IRelationship[];
    public readonly lifespan: number;
    public readonly built: boolean;

    constructor(options: INodeOptions) {
        const {
            uri,
            label,
            node_type,
            attributes,
            relationships,
            lifespan
        } = options;

        this.uri = uri;
        this.label = label;
        this.node_type = node_type;

        // Set defaults for optional collections to avoid null/undefined checks later.
        this.attributes = attributes ?? [];
        this.relationships = relationships ?? [];

        // Set the lifespan, using the default value if none is provided.
        this.lifespan = lifespan ?? defaultLifespan;

        // Si il manque le type on ne considère pas les noeuds comme built.
        this.built = node_type !== undefined;
    }
}

/**
 * Extrait la partie de l'URI après le # qui sépare le nom de l'entité de son ontologie.
 * Si # n'est pas présent retourne l'URI original.
 * 
 * @example
 * extractAfterHash("http://example.org/ontology#Person") // returns "Person"
 * extractAfterHash("http://example.org/ontology#hasName") // returns "hasName"
 * extractAfterHash("http://example.org/ontology") // returns "http://example.org/ontology"
 */
export function extractAfterHash(uri: string): string {
    const hashIndex = uri.indexOf('#');
    if (hashIndex === -1) {
        return uri;
    }
    return uri.substring(hashIndex + 1);
}

/**
 * Extrait la partie de l'URI après le dernier slash.
 * Si le slash n'est pas présent, retourne l'URI original.
 * Le fonctionnement est similaire à extractAfterHash.
 */
export function extractAfterLastSlash(uri: string): string {
    const lastSlashIndex = uri.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return uri;
    }
    return uri.substring(lastSlashIndex + 1);
}

/**
 * Contient une représentation partielle de l'ontologie pour l'afficher au LLM.
 */
export class ResultRepresentation {
    /**
     * Index les Node par rapport à leur URI.
     */
    public readonly nodes: Map<string, Node>;

    constructor(nodes: Map<string, Node> = new Map()) {
        this.nodes = nodes;
    }

    /**
     * Produis un nouveau graph avec certains anciens et tous les nouveaux noeuds.
     * Met à jour la valeur lifespan des noeuds.
     * Si le noeud était spécifié dans le paramètre nodes, son lifespan est réinitialisé à defaultLifespan.
     * Sinon, il est décrémenté. Le noeud est ommis du nouveau graph si son lifespan atteint zéro.
     * Ajoute un noeud partiel (non built) pour chaque URI inconnu découvert dans relationships.
     */
    public updateWithNodes(nodes: Node[]): ResultRepresentation {
        const newNodesMap = new Map<string, Node>();
        const updatedUris = new Set(nodes.map(n => n.uri));

        // Add or update nodes from the input, resetting their lifespan
        for (const node of nodes) {
            newNodesMap.set(
                node.uri,
                new Node({
                    ...node,
                    lifespan: defaultLifespan
                })
            );
        }

        // Decrement lifespan for existing nodes not in the update
        for (const [uri, node] of this.nodes.entries()) {
            if (!updatedUris.has(uri)) {
                const newLifespan = (node.lifespan ?? defaultLifespan) - 1;
                if (newLifespan > 0) {
                    newNodesMap.set(
                        uri,
                        new Node({
                            ...node,
                            lifespan: newLifespan
                        })
                    );
                }
            }
        }

        // Ajoute un noeud non built pour chaque URI inconnu découvert dans relationships.
        const allKnownUris = new Set(newNodesMap.keys());
        const unknownUris = new Set<string>();

        // 1. Récupérer tous les URI inconnus dans relationships
        for (const node of newNodesMap.values()) {
            for (const relationship of node.relationships) {
                if (!allKnownUris.has(relationship.target_uri)) {
                    unknownUris.add(relationship.target_uri);
                }
            }
        }

        // 2. Créer les noeuds partiels (non built)
        for (const unknownUri of unknownUris) {
            newNodesMap.set(unknownUri, new Node({
                uri: unknownUri,
                lifespan: defaultLifespan
            }));
        }

        return new ResultRepresentation(newNodesMap);
    }

    /**
     * Récupère une Node par son URI.
     */
    public getNodeByUri(uri: string): Node | undefined {
        return this.nodes.get(uri);
    }

    /**
     * Produit une représentation textuelle des données du graph adaptée pour un LLM.
     * Format pseudo-YAML avec URI complets et peu de redondances.
     */
    public toString(): string {
        const lines: string[] = [];
        
        // Séparer les noeuds construits (built) et non construits
        const builtNodes: Node[] = [];
        const partialNodes: Node[] = [];
        
        for (const node of this.nodes.values()) {
            if (node.built) {
                builtNodes.push(node);
            } else {
                partialNodes.push(node);
            }
        }

        // Trier par URI pour une sortie déterministe
        builtNodes.sort((a, b) => a.uri.localeCompare(b.uri));
        partialNodes.sort((a, b) => a.uri.localeCompare(b.uri));

        lines.push("REPRESENTATION DES RECHERCHES ONTOLOGIQUES");
        lines.push("============================");
        lines.push("");

        // Section des noeuds complets (built)
        if (builtNodes.length > 0) {
            lines.push("Entités Découvertes:");
            lines.push("");
            
            for (const node of builtNodes) {
                lines.push(`- Entity: "${extractAfterLastSlash(node.uri)}"`);

                if (node.label) {
                    lines.push(`  label: "${node.label}"`);
                }
                
                if (node.node_type) {
                    lines.push(`  type: ${extractAfterLastSlash(node.node_type)}`);
                }
                
                // Attributs (propriétés avec valeurs littérales)
                if (node.attributes.length > 0) {
                    lines.push("  attributes:");
                    for (const attr of node.attributes) {
                        const value = attr.parsed_value || attr.value;
                        let new_line = `      ${attr.property_label}: "${value}"`;
                        if (attr.datatype !== "http://www.w3.org/2001/XMLSchema#string") {
                            new_line += ` (datatype: ${attr.datatype})`;
                        }
                        lines.push(new_line);
                    }
                }
                
                // Relations (propriétés avec valeurs d'objets)
                if (node.relationships.length > 0) {
                    lines.push("  relationships:");
                    for (const relationship of node.relationships) {
                        const direction = relationship.direction === 'outgoing' ? '→' : '←';
                        // Affine le libellé selon la direction pour plus de clarté sémantique
                        let predicateLabel = relationship.predicate_label;
                        if (relationship.predicate_uri === 'http://www.w3.org/2000/01/rdf-schema#subClassOf' && relationship.direction === 'incoming') {
                            predicateLabel = 'a pour sous-classe';
                        }
                        if (relationship.predicate_uri === 'http://www.semanticweb.org/custom/belongsToClass' && relationship.direction === 'incoming') {
                            predicateLabel = 'a pour instance';
                        }
                        const new_line = `    - soi ${direction} ${predicateLabel}: ${extractAfterLastSlash(relationship.target_uri)}`;
                        lines.push(new_line);
                    }
                }
                lines.push("");
            }
        }

        // Section des noeuds partiels (références découvertes mais non détaillées)
        if (partialNodes.length > 0) {
            lines.push("URI des Entités à Découvrir avec les tools:");
            lines.push("");
            
            for (const node of partialNodes) {
                let new_line = `"${node.uri}"`;
                if (node.label) {
                    new_line += ` (label: "${node.label}")`;
                }
                lines.push(new_line);
            }
            lines.push("");
        }

        // Statistiques du graph
        lines.push("STATISTIQUES:");
        lines.push(`  total_entities: ${this.nodes.size}`);
        lines.push(`  detailed_entities: ${builtNodes.length}`);
        lines.push(`  referenced_entities: ${partialNodes.length}`);

        return lines.join("\n");
    }
}
