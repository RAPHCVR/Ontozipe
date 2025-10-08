import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";

type QueryOptions = {
	enabled?: boolean;
	staleTime?: number;
};

type Profile = {
	name?: string;
	avatar?: string;
	email?: string;
	isVerified?: boolean;
	roles?: string[];
};

type Fetcher = <T>(path: string) => Promise<T>;

const useJsonFetcher = (): Fetcher => {
	const api = useApi();
	return async <T>(path: string) => {
		const res = await api(path);
		return res.json() as Promise<T>;
	};
};

export const useProfile = (options: QueryOptions = {}) => {
	const { token } = useAuth();
	const fetchJson = useJsonFetcher();
	return useQuery({
		queryKey: ["auth", "profile"],
		queryFn: () => fetchJson<Profile>("/auth/me"),
		enabled: Boolean(token) && (options.enabled ?? true),
		staleTime: options.staleTime ?? 5 * 60 * 1000,
		select: (data) => ({
			name: data.name,
			avatar: data.avatar,
			email: data.email,
			isVerified: data.isVerified ?? false,
			roles: data.roles ?? [],
		}),
	});
};

export const useOntologies = (options: QueryOptions = {}) => {
	const { token } = useAuth();
	const fetchJson = useJsonFetcher();
	return useQuery({
		queryKey: ["ontologies"],
		queryFn: () =>
			fetchJson<
				Array<{
					iri: string;
					label?: string;
					labelLang?: string;
					languages?: string[];
				}>
			>("/ontologies"),
		enabled: Boolean(token) && (options.enabled ?? true),
		staleTime: options.staleTime ?? 30 * 1000,
	});
};

export const useGroups = (options: QueryOptions = {}) => {
	const { token } = useAuth();
	const fetchJson = useJsonFetcher();
	return useQuery({
		queryKey: ["groups"],
		queryFn: () => fetchJson<Array<any>>("/groups"),
		enabled: Boolean(token) && (options.enabled ?? true),
		staleTime: options.staleTime ?? 15 * 1000,
	});
};

export const useOrganizations = (
	scope: "all" | "mine",
	options: QueryOptions = {}
) => {
	const { token } = useAuth();
	const fetchJson = useJsonFetcher();
	return useQuery({
		queryKey: ["organizations", scope],
		queryFn: () =>
			fetchJson<Array<{ iri: string; label?: string; owner?: string }>>(
				scope === "all" ? "/organizations" : "/organizations?mine=true"
			),
		enabled: Boolean(token) && (options.enabled ?? true),
		staleTime: options.staleTime ?? 60 * 1000,
	});
};

export const useOrganizationMembers = (
	organizationIri?: string,
	options: QueryOptions = {}
) => {
	const fetchJson = useJsonFetcher();
	return useQuery({
		queryKey: ["organizations", "members", organizationIri],
		queryFn: () =>
			fetchJson<Array<any>>(
				`/organizations/${encodeURIComponent(organizationIri ?? "")}/members`
			),
		enabled: Boolean(organizationIri) && (options.enabled ?? true),
		staleTime: options.staleTime ?? 30 * 1000,
	});
};

export const usePersons = (options: QueryOptions = {}) => {
	const { token } = useAuth();
	const fetchJson = useJsonFetcher();
	return useQuery({
		queryKey: ["individuals", "persons"],
		queryFn: () => fetchJson<Array<any>>("/individuals/persons"),
		enabled: Boolean(token) && (options.enabled ?? true),
		staleTime: options.staleTime ?? 5 * 60 * 1000,
	});
};
