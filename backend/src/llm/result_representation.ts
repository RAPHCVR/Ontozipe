
// CONFIGURATION
const DEFAULT_LIFESPAN = 5;
const THRESHOLD_HIDE_ATTRIBUTES = 3; // Below this, attributes vanish
const THRESHOLD_HIDE_RELATIONS = 1;  // Below this, relations vanish (ghost mode)

const isHttpUri = (value: string): boolean => /^https?:\/\//i.test(value);

const makeHandle = (uri: string): string => {
    const afterHash = extractAfterHash(uri);
    if (afterHash && afterHash !== uri) return afterHash;
    const afterSlash = extractAfterLastSlash(uri);
    return afterSlash || uri;
};

const normalizeKey = (value: string): string => value.trim().toLowerCase();

const buildGraphPath = (ontologyIri: string, handle: string): string =>
    `/ontology?iri=${encodeURIComponent(ontologyIri)}&focus=${encodeURIComponent(handle)}`;

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
        this.lifespan = lifespan ?? DEFAULT_LIFESPAN;

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
    private readonly handleToUri: Map<string, string>;

    constructor(nodes: Map<string, Node> = new Map()) {
        this.nodes = nodes;
        this.handleToUri = new Map<string, string>();
        for (const [uri, node] of nodes.entries()) {
            this.registerHandles(uri, node);
        }
    }

    /**
     * Produis un nouveau graph avec certains anciens et tous les nouveaux noeuds.
     * Met à jour la valeur lifespan des noeuds.
     * Si le noeud était spécifié dans le paramètre nodes, son lifespan est réinitialisé à DEFAULT_LIFESPAN.
     * Sinon, il est décrémenté. Le noeud est ommis du nouveau graph si son lifespan atteint zéro.
     * Ajoute un noeud partiel (non built) pour chaque URI inconnu découvert dans relationships.
     */
    public updateWithNodes(nodes: Node[]): ResultRepresentation {
        const newNodesMap = new Map<string, Node>();
        const updatedUris = new Set(nodes.map(n => n.uri));

        // 1. Nouvelles Nodes : Réinitialiser lifespan au max
        for (const node of nodes) {
            newNodesMap.set(
                node.uri,
                new Node({ ...node, lifespan: DEFAULT_LIFESPAN })
            );
        }

        // 2. NOEUDS EXISTANTS : Décrémenter lifespan
        for (const [uri, node] of this.nodes.entries()) {
            if (!updatedUris.has(uri)) {
                const newLifespan = (node.lifespan ?? DEFAULT_LIFESPAN) - 1;
                
                // Ne conserver que si lifespan > 0
                if (newLifespan > 0) {
                    newNodesMap.set(
                        uri,
                        new Node({ ...node, lifespan: newLifespan })
                    );
                }
            }
        }

        // 3. NOEUDS PARTIELS : Ajouter des noeuds non construits découverts dans les relations
        // Seulement s'ils ne sont pas déjà dans le mapping (pour éviter d'écraser des noeuds détaillés avec des noeuds fantômes)
        const allKnownUris = new Set(newNodesMap.keys());
        const unknownUris = new Set<string>();

        for (const node of newNodesMap.values()) {
            // N'afficher que les relations des noeuds qui ont un lifespan assez grand pour montrer les relations
            if (node.lifespan > THRESHOLD_HIDE_RELATIONS) {
                for (const relationship of node.relationships) {
                    if (!allKnownUris.has(relationship.target_uri)) {
                        unknownUris.add(relationship.target_uri);
                    }
                }
            }
        }

        for (const unknownUri of unknownUris) {
            // Les noeuds "fantômes" commencent avec un lifespan plus court pour éviter l'accumulation de désordre
            newNodesMap.set(unknownUri, new Node({
                uri: unknownUri,
                lifespan: Math.floor(DEFAULT_LIFESPAN / 2) 
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

    private registerHandles(uri: string, node?: Node) {
        const register = (key: string | undefined) => {
            if (!key) return;
            this.handleToUri.set(key, uri);
            this.handleToUri.set(normalizeKey(key), uri);
        };

        register(uri);
        register(makeHandle(uri));

        if (node?.label) {
            register(node.label);
        }
        if (node?.node_type) {
            register(makeHandle(node.node_type));
        }
    }

    /**
     * Essaie de retrouver l'URI d'une entité à partir d'un identifiant partiel (handle,
     * label, suffixe). Retourne undefined si aucune correspondance.
     */
    public findMatchingUri(identifier: string): string | undefined {
        if (!identifier) return undefined;
        const direct = this.handleToUri.get(identifier) ?? this.handleToUri.get(normalizeKey(identifier));
        if (direct) return direct;

        for (const uri of this.nodes.keys()) {
            if (uri === identifier) return uri;
            if (uri.toLowerCase() === identifier.toLowerCase()) return uri;
            if (uri.endsWith(`#${identifier}`) || uri.endsWith(`/${identifier}`)) {
                return uri;
            }
        }
        return undefined;
    }

    /**
     * Produit une représentation textuelle des données du graph adaptée pour un LLM.
     * Format pseudo-YAML avec URI complets et peu de redondances.
     */
    public toString(options?: { ontologyIri?: string; frontendBaseUrl?: string }): string {
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

        // Trier par lifespan décroissant (pertinence), puis par URI pour une sortie déterministe
        builtNodes.sort((a, b) => (b.lifespan ?? 0) - (a.lifespan ?? 0) || a.uri.localeCompare(b.uri));
        partialNodes.sort((a, b) => a.uri.localeCompare(b.uri));

        lines.push("REPRESENTATION DES RECHERCHES ONTOLOGIQUES");
        lines.push("============================");
        lines.push("");

        // Section des noeuds complets (built)
        if (builtNodes.length > 0) {
            lines.push("Entités (Détail décroissant selon pertinence):");
            lines.push("");
            
            for (const node of builtNodes) {
                const handle = makeHandle(node.uri);
                
                // --- LOGIQUE DE VISUALISATION (DECAY) ---
                const showAttributes = (node.lifespan ?? 0) > THRESHOLD_HIDE_ATTRIBUTES;
                const showRelations = (node.lifespan ?? 0) > THRESHOLD_HIDE_RELATIONS;
                const isFading = (node.lifespan ?? 0) <= THRESHOLD_HIDE_ATTRIBUTES;

                // En-tête de l'entité avec marqueur de contexte si ancien
                let header = `- Entité: ${handle}`;
                if (isFading) header += ` [Contexte ancien]`;
                lines.push(header);

                if (node.label) {
                    lines.push(`  label: "${node.label}"`);
                }
                
                if (node.node_type) {
                    lines.push(`  type: ${extractAfterLastSlash(node.node_type)}`);
                }
                if (options?.ontologyIri) {
                    const graphPath = buildGraphPath(options.ontologyIri, handle);
                    const link = options.frontendBaseUrl
                        ? `${options.frontendBaseUrl.replace(/\/$/, "")}${graphPath}`
                        : graphPath;
                    lines.push(`  graph_link: ${link}`);
                }

                // Attributs (propriétés avec valeurs littérales)
                // Masqués si le lifespan est sous le seuil
                if (showAttributes && node.attributes.length > 0) {
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
                // Masqués si le lifespan est sous le seuil (mode fantôme)
                if (showRelations && node.relationships.length > 0) {
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
                        const new_line = `    - self ${direction} ${predicateLabel}: ${extractAfterLastSlash(relationship.target_uri)}`;
                        lines.push(new_line);
                    }
                }
                lines.push("");
            }
        }

        // Section des noeuds partiels (références découvertes mais non détaillées)
        const filteredPartials = partialNodes.filter((node) => {
            const uri = node.uri;
            if (!uri) return false;
            if (!isHttpUri(uri)) return false;
            const handle = makeHandle(uri);
            return !/^b\d+$/i.test(handle);
        });

        // Statistiques du graph
        lines.push("STATISTIQUES:");
        lines.push(`  total_entities: ${this.nodes.size}`);
        lines.push(`  detailed_entities: ${builtNodes.length}`);
        lines.push(`  referenced_entities: ${filteredPartials.length}`);

        return lines.join("\n");
    }
}
