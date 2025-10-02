import type { MemberOption } from "../components/members";

type PersonProperty = {
    predicate?: string;
    value: string;
};

type PersonLike = {
    id?: string;
    iri?: string;
    label?: string;
    properties?: PersonProperty[];
};

const NAME_HINTS = ["#name", "/name"];
const EMAIL_HINTS = ["#email", "/email"];

export type PersonDetails = {
    id: string;
    name: string;
    email?: string;
};

const getLastFragment = (iri: string) => {
    const cleaned = iri.trim();
    if (cleaned === "") return iri;
    const segments = cleaned.split(/[#/]/).filter(Boolean);
    return segments.pop() ?? cleaned;
};

const decodeFragment = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch (_error) {
        return value;
    }
};

const prettifyIdentifier = (identifier: string) => {
    const decoded = decodeFragment(identifier);
    const emailSeparator = decoded.indexOf("@");
    const base = emailSeparator !== -1 ? decoded.slice(0, emailSeparator) : decoded;
    const cleaned = base.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned === "") return decoded;
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const derivePersonDetails = (person: PersonLike): PersonDetails | null => {
    const id = person.id ?? person.iri;
    if (!id) return null;

    const properties = person.properties ?? [];
    const normalized = (value?: string) => value?.trim() ?? "";

    const nameFromProperty = properties.find((prop) => {
        const predicate = prop.predicate?.toLowerCase();
        return predicate ? NAME_HINTS.some((hint) => predicate.endsWith(hint)) : false;
    })?.value;
    const emailFromProperty = properties.find((prop) => {
        const predicate = prop.predicate?.toLowerCase();
        return predicate ? EMAIL_HINTS.some((hint) => predicate.endsWith(hint)) : false;
    })?.value;

    const fragment = getLastFragment(id);
    const fallbackLabel = prettifyIdentifier(fragment);
    const fallbackEmail = decodeFragment(fragment);

    const rawLabel = normalized(person.label);
    const labelLooksLikeEmail = rawLabel.includes("@");

    const name =
        normalized(nameFromProperty) ||
        (labelLooksLikeEmail ? "" : rawLabel) ||
        fallbackLabel;
    const email =
        normalized(emailFromProperty) ||
        (labelLooksLikeEmail ? rawLabel : undefined) ||
        (fallbackEmail.includes("@") ? fallbackEmail : undefined);

    return {
        id,
        name,
        email,
    };
};

export const personsToMemberOptions = (persons: PersonLike[]): MemberOption[] => {
    return persons
        .map((person) => derivePersonDetails(person))
        .filter((details): details is PersonDetails => Boolean(details))
        .map((details) => ({
            id: details.id,
            label: details.name,
            subtitle: details.email,
        }));
};

export const buildPersonIndex = (persons: PersonLike[]): Map<string, PersonDetails> => {
    const index = new Map<string, PersonDetails>();
    persons.forEach((person) => {
        const details = derivePersonDetails(person);
        if (details) {
            index.set(details.id, details);
        }
    });
    return index;
};

export type PersonDisplay = {
    name: string;
    email?: string;
};

export const getPersonDisplay = (
    index: Map<string, PersonDetails>,
    iri?: string
): PersonDisplay | undefined => {
    if (!iri) return undefined;
    const details = index.get(iri);
    if (details) return details;

    const fragment = getLastFragment(iri);
    const name = prettifyIdentifier(fragment);
    const decoded = decodeFragment(fragment);
    const email = decoded.includes("@") ? decoded : undefined;
    return { name, email };
};
