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
    createdBy?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt?: string;
    visibleTo?: string[];
    groups?: { iri: string; label?: string }[];
}

export interface CommentNode {
    id: string;
    body: string;
    onResource: string;
    replyTo?: string;
    createdBy: string;
    createdAt: string;
    updatedBy?: string;
    updatedAt?: string;
    visibleTo?: string[];
}

export interface NodeData {
    id: string;
    label: string | undefined;
    title: string;
}

export interface EdgeData {
    from: string;
    to: string;
}

export interface Individual {
    id: string;
    label: string;
    classId: string;
}

export interface FullSnapshot {
    graph: { nodes: NodeData[]; edges: EdgeData[] };
    individuals: IndividualNode[];
    persons: IndividualNode[];
}

export interface GroupInfo {
    iri: string;
    label?: string;
    createdBy: string;
    members: string[];
    organizationIri?: string;
}

export interface OrganizationInfo {
    iri: string;
    label?: string;
    owner: string;
    createdAt: string;
}

