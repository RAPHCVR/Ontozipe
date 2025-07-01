export interface Property {
	predicate: string;
	predicateLabel?: string;
	value: string;
	valueLabel?: string;
	isLiteral: boolean;
}

export interface IndividualNode {
	id: string;
	label: string;
	classId: string;
	properties: Property[];
	children: IndividualNode[];

	/** Méta‑données */
	createdBy?: string;
	createdAt?: string; // xsd:dateTime ISO
	updatedBy?: string;
	updatedAt?: string;
	visibleTo?: string[]; // liste des groupes core:visibleTo
	groups?: { iri: string; label?: string }[];
}

/** Commentaire attaché à une ressource (core:Comment) */
export interface CommentNode {
	id: string;
	body: string; // texte du commentaire
	onResource: string; // IRI de l’individu ou ressource ciblée
	replyTo?: string; // IRI du commentaire parent (optionnel)

	/** Méta‑données */
	createdBy: string;
	createdAt: string;
	updatedBy?: string;
	updatedAt?: string;
	visibleTo?: string[];
}

export type Snapshot = {
	graph: { nodes: any[]; edges: any[] };
	individuals: IndividualNode[]; // flat list, no children
	persons: IndividualNode[]; // foaf:Person
	comments: CommentNode[];
};
