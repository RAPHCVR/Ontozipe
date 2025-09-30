import { escapeSparqlLiteral } from "../../utils/sparql.utils";

export const rdfLiteral = (value: string, lang?: string): string => {
    const literal = `"""${escapeSparqlLiteral(value)}"""`;
    return lang ? `${literal}@${lang}` : literal;
};

export const toRdfTerm = (value: string, isLiteral: boolean): string =>
    isLiteral ? rdfLiteral(value) : `<${value}>`;

