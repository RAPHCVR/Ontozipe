import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
const useJsonFetcher = () => {
    const api = useApi();
    return async (path) => {
        const res = await api(path);
        return res.json();
    };
};
export const useProfile = (options = {}) => {
    const { token } = useAuth();
    const fetchJson = useJsonFetcher();
    return useQuery({
        queryKey: ["auth", "profile", token],
        queryFn: () => fetchJson("/auth/me"),
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
export const useOntologies = (options = {}) => {
    const { token } = useAuth();
    const fetchJson = useJsonFetcher();
    return useQuery({
        queryKey: ["ontologies"],
        queryFn: () => fetchJson("/ontologies"),
        enabled: Boolean(token) && (options.enabled ?? true),
        staleTime: options.staleTime ?? 30 * 1000,
    });
};
export const useGroups = (options = {}) => {
    const { token } = useAuth();
    const fetchJson = useJsonFetcher();
    return useQuery({
        queryKey: ["groups"],
        queryFn: () => fetchJson("/groups"),
        enabled: Boolean(token) && (options.enabled ?? true),
        staleTime: options.staleTime ?? 15 * 1000,
    });
};
export const useOrganizations = (scope, options = {}) => {
    const { token } = useAuth();
    const fetchJson = useJsonFetcher();
    return useQuery({
        queryKey: ["organizations", scope],
        queryFn: () => fetchJson(scope === "all" ? "/organizations" : "/organizations?mine=true"),
        enabled: Boolean(token) && (options.enabled ?? true),
        staleTime: options.staleTime ?? 60 * 1000,
    });
};
export const useOrganizationMembers = (organizationIri, options = {}) => {
    const fetchJson = useJsonFetcher();
    return useQuery({
        queryKey: ["organizations", "members", organizationIri],
        queryFn: () => fetchJson(`/organizations/${encodeURIComponent(organizationIri ?? "")}/members`),
        enabled: Boolean(organizationIri) && (options.enabled ?? true),
        staleTime: options.staleTime ?? 30 * 1000,
    });
};
export const usePersons = (options = {}) => {
    const { token } = useAuth();
    const fetchJson = useJsonFetcher();
    return useQuery({
        queryKey: ["individuals", "persons"],
        queryFn: () => fetchJson("/individuals/persons"),
        enabled: Boolean(token) && (options.enabled ?? true),
        staleTime: options.staleTime ?? 5 * 60 * 1000,
    });
};
