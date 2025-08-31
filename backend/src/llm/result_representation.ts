import { EntityDetails } from "./queries"

export interface Node {
    uri: string;
    details?: EntityDetails;
    lifespan?: number;
}

export const defaultLifespan = 3;

export class SparqlResultRepresentation {
    // Changement de structure : dictionnaire indexé par URI pour optimisation
    private nodesMap: Map<string, Node> = new Map();

    /**
     * Met à jour les nodes avec une liste d'URIs.
     * Crée des nodes pour les URIs qui n'existent pas encore.
     * Définit le lifespan à "default lifespan" pour tous les nodes.
     * @param uris Liste des URIs à traiter
     * @returns Liste des nodes qui étaient nouvelles (pas dans le dictionnaire avant)
     */
    updateNodes(uris: string[]): Node[] {
        const newNodes: Node[] = [];

        for (const uri of uris) {
            let node = this.nodesMap.get(uri);
            
            if (!node) {
                // Créer un nouveau node
                node = {
                    uri,
                    lifespan: defaultLifespan
                };
                this.nodesMap.set(uri, node);
                newNodes.push(node);
            } else {
                // Node existant, mettre à jour le lifespan
                node.lifespan = defaultLifespan;
            }
        }

        return newNodes;
    }

    /**
     * Ajoute les détails d'entités aux nodes correspondants.
     * @param entityDetailsMap Mapping URI vers EntityDetails
     */
    provideEntityDetails(entityDetailsMap: Map<string, EntityDetails>): void {
        for (const [uri, entityDetails] of entityDetailsMap) {
            const node = this.nodesMap.get(uri);
            if (node) {
                node.details = entityDetails;
            }
        }
    }

    /**
     * Getter pour accéder aux nodes sous forme de tableau (pour compatibilité)
     */
    get nodes(): Node[] {
        return Array.from(this.nodesMap.values());
    }

    /**
     * Getter pour accéder à un node par URI
     */
    getNode(uri: string): Node | undefined {
        return this.nodesMap.get(uri);
    }

    /**
     * Getter pour accéder au Map des nodes
     */
    get nodesAsMap(): Map<string, Node> {
        return this.nodesMap;
    }
}
