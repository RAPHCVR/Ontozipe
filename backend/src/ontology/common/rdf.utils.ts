import { escapeSparqlLiteral } from "../../utils/sparql.utils";

export const rdfLiteral = (value: string): string => `"""${escapeSparqlLiteral(value)}"""`;

export const toRdfTerm = (value: string, isLiteral: boolean): string =>
    isLiteral ? rdfLiteral(value) : `<${value}>`;

