import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import SimpleModal from "../components/SimpleModal";
import { MemberSelector, MemberOption } from "../components/members";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import {
	useOrganizationMembers,
	useOrganizations,
	usePersons,
	useProfile,
} from "../hooks/apiQueries";
import { useToast } from "../hooks/toast";
import { useTranslation } from "../language/useTranslation";

type Organisation = {
	iri: string;
	label?: string;
	owner: string;
	createdAt: string;
};

type OrganisationDetails = Organisation;

type CreateOrganizationInput = {
	label: string;
	ownerIri: string;
};

type DeleteOrganizationInput = { iri: string };

type OrganisationsMutationContext = {
	previousOrganizations: Organisation[];
};

export default function OrganisationsPage() {
	const api = useApi();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const { t } = useTranslation();
	const currentUserIri = user?.sub;
	const { success: toastSuccess, error: toastError } = useToast();

	const profileQuery = useProfile();
	const roles = profileQuery.data?.roles ?? [];
	const isSuperAdmin = roles.some((role) => role.endsWith("SuperAdminRole"));
	const rolesLoaded = !profileQuery.isLoading && !profileQuery.isFetching;

	const organizationsScope = isSuperAdmin ? "all" : "mine";
	const organizationsQuery = useOrganizations(organizationsScope, {
		enabled: rolesLoaded,
	});
	const organizations = useMemo(
		() =>
			(organizationsQuery.data ?? []).map(
				(organization: any): Organisation => ({
					iri: organization.iri,
					label: organization.label,
					owner: organization.owner,
					createdAt: organization.createdAt,
				})
			),
		[organizationsQuery.data]
	);

	const personsQuery = usePersons({ enabled: rolesLoaded });
	const persons = useMemo<MemberOption[]>(
		() =>
			(personsQuery.data ?? []).map((person: any) => {
				const id = person.id;
				const email = person.properties?.find((prop: any) =>
					prop.predicate?.toLowerCase().endsWith("#email")
				)?.value;
				const name =
					person.properties?.find((prop: any) =>
						prop.predicate?.toLowerCase().endsWith("#name")
					)?.value ??
					person.label ??
					formatLabel(id);
				return { id, label: name, subtitle: email };
			}),
		[personsQuery.data]
	);

	const [showCreateModal, setShowCreateModal] = useState(false);
	const [focusedOrganisation, setFocusedOrganisation] =
		useState<OrganisationDetails | null>(null);

	const refreshOrganizations = () => {
		queryClient.invalidateQueries({
			queryKey: ["organizations", organizationsScope],
		});
	};

	const createOrganizationMutation = useMutation<
		string | undefined,
		Error,
		CreateOrganizationInput,
		OrganisationsMutationContext
	>({
		mutationFn: async ({ label, ownerIri }) => {
			const response = await api("/organizations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label, ownerIri }),
			});
			if (!response.ok) throw new Error(await response.text());
			const contentType = response.headers.get("content-type");
			if (contentType?.includes("application/json")) {
				const json = await response.json();
				return typeof json === "string" ? json : json?.iri;
			}
			return (await response.text()) || undefined;
		},
		onMutate: async ({ label, ownerIri }) => {
			await queryClient.cancelQueries({
				queryKey: ["organizations", organizationsScope],
			});
			const previous = (
				queryClient.getQueryData<Organisation[]>([
					"organizations",
					organizationsScope,
				]) ?? []
			).slice();
			const optimistic: Organisation = {
				iri: `temp-${Date.now()}`,
				label,
				owner: ownerIri,
				createdAt: new Date().toISOString(),
			};
			queryClient.setQueryData<Organisation[]>(
				["organizations", organizationsScope],
				[...previous, optimistic]
			);
			return { previousOrganizations: previous };
		},
		onError: (_error, _input, context) => {
			if (context) {
				queryClient.setQueryData(
					["organizations", organizationsScope],
					context.previousOrganizations
				);
			}
			toastError("Impossible de créer l’organisation.");
		},
		onSuccess: () => toastSuccess("Organisation créée avec succès."),
		onSettled: () => refreshOrganizations(),
	});

	const deleteOrganizationMutation = useMutation<
		void,
		Error,
		DeleteOrganizationInput,
		OrganisationsMutationContext
	>({
		mutationFn: async ({ iri }) => {
			const response = await api(`/organizations/${encodeURIComponent(iri)}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error(await response.text());
		},
		onMutate: async ({ iri }) => {
			await queryClient.cancelQueries({
				queryKey: ["organizations", organizationsScope],
			});
			const previous = (
				queryClient.getQueryData<Organisation[]>([
					"organizations",
					organizationsScope,
				]) ?? []
			).slice();
			queryClient.setQueryData<Organisation[]>(
				["organizations", organizationsScope],
				previous.filter((organization) => organization.iri !== iri)
			);
			return { previousOrganizations: previous };
		},
		onError: (_error, _input, context) => {
			if (context) {
				queryClient.setQueryData(
					["organizations", organizationsScope],
					context.previousOrganizations
				);
			}
			toastError("Suppression de l’organisation impossible.");
		},
		onSuccess: () => toastSuccess("Organisation supprimée."),
		onSettled: () => refreshOrganizations(),
	});

	const isLoading =
		organizationsQuery.isLoading || organizationsQuery.isFetching;
	const hasOrganizations = organizations.length > 0;

	return (
		<div className="page">
			<div className="app-container page__inner">
				<header className="page-header">
					<div>
						<h1 className="page-title">Organisations</h1>
						<p className="page-subtitle">
							Structurez vos équipes, attribuez des administrateurs et gérez les
							accès aux ontologies en un seul endroit.
						</p>
					</div>
					{isSuperAdmin && (
						<button
							type="button"
							className="button button--primary"
							onClick={() => setShowCreateModal(true)}>
							<i className="fas fa-building" aria-hidden="true" />
							Nouvelle organisation
						</button>
					)}
				</header>

				{isLoading && (
					<div className="page-state">
						<div className="page-state__spinner" aria-hidden="true" />
						<p className="page-state__text">Chargement des organisations…</p>
					</div>
				)}

				{!isLoading && !hasOrganizations && (
					<div className="page-empty">
						<p>Aucune organisation n’est enregistrée pour le moment.</p>
						<p>
							Créez-en une pour regrouper vos utilisateurs et partager vos
							ontologies.
						</p>
					</div>
				)}

				{!isLoading && hasOrganizations && (
					<ul className="entity-grid">
						{organizations.map((organization) => {
							const ownerLabel =
								persons.find((person) => person.id === organization.owner)
									?.label ?? formatLabel(organization.owner);
							const createdAt = new Date(organization.createdAt);
							return (
								<li key={organization.iri} className="entity-card">
									<div className="entity-card__header">
										<div>
											<h3 className="entity-card__title">
												{formatLabel(organization.label ?? organization.iri)}
											</h3>
											<p className="entity-card__subtitle">
												Admin : {ownerLabel}
											</p>
										</div>
										<div className="entity-card__actions">
											<button
												type="button"
												className="icon-button"
												aria-label="Voir l’organisation"
												onClick={() =>
													setFocusedOrganisation({ ...organization })
												}>
												<i className="fas fa-eye" aria-hidden="true" />
											</button>
											{isSuperAdmin && (
												<button
													type="button"
													className="icon-button icon-button--danger"
													aria-label="Supprimer l’organisation"
													disabled={deleteOrganizationMutation.isPending}
													onClick={() =>
														deleteOrganizationMutation.mutate({
															iri: organization.iri,
														})
													}>
													<i className="fas fa-trash" aria-hidden="true" />
												</button>
											)}
										</div>
									</div>
									<div className="entity-card__footer">
										<span className="entity-chip">
											<i className="fas fa-calendar" aria-hidden="true" />
											{createdAt.toLocaleDateString()}
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{showCreateModal && (
				<OrganisationFormModal
					onClose={() => setShowCreateModal(false)}
					onCreate={async (payload) => {
						await createOrganizationMutation.mutateAsync(payload);
					}}
					persons={persons}
					personsLoading={personsQuery.isLoading}
					isSubmitting={createOrganizationMutation.isPending}
				/>
			)}

			{focusedOrganisation && (
				<OrganisationDetailsModal
					org={focusedOrganisation}
					isSuperAdmin={isSuperAdmin}
					isManager={
						isSuperAdmin || focusedOrganisation.owner === currentUserIri
					}
					onClose={() => setFocusedOrganisation(null)}
					onReload={refreshOrganizations}
					persons={persons}
					personsLoading={personsQuery.isLoading}
					onDeleteOrganization={async (iri) => {
						await deleteOrganizationMutation.mutateAsync({ iri });
					}}
					deleting={deleteOrganizationMutation.isPending}
				/>
			)}
		</div>
	);
}

function OrganisationFormModal({
	onClose,
	onCreate,
	persons,
	personsLoading,
	isSubmitting,
}: {
	onClose: () => void;
	onCreate: (input: CreateOrganizationInput) => Promise<void>;
	persons: MemberOption[];
	personsLoading: boolean;
	isSubmitting: boolean;
}) {
	const [label, setLabel] = useState("");
	const [owner, setOwner] = useState<string>("");

	const disabled = label.trim() === "" || owner === "";
	const { t } = useTranslation();

	const handleSubmit = async () => {
		if (disabled) return false;
		try {
			await onCreate({ label: label.trim(), ownerIri: owner });
			return true;
		} catch (error) {
			return false;
		}
	};

	return (
		<SimpleModal
			title="Nouvelle organisation"
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={disabled || isSubmitting}
			submitLabel={isSubmitting ? "Création…" : "Créer"}>
			<div className="form-grid">
				<div className="form-field form-field--floating">
					<input
						id="org-name"
						className="form-input"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder=" "
						autoComplete="off"
					/>
					<label className="form-label form-label--floating" htmlFor="org-name">
						Nom de l’organisation
					</label>
				</div>

				<div className="form-field">
					<label className="form-label form-label--static" htmlFor="org-owner">
						Administrateur principal
					</label>
					<select
						id="org-owner"
						className="form-input"
						value={owner}
						onChange={(event) => setOwner(event.target.value)}
						disabled={personsLoading}>
						<option value="">Sélectionner un utilisateur</option>
						{persons.map((person) => (
							<option key={person.id} value={person.id}>
								{person.label}
							</option>
						))}
					</select>
				</div>
			</div>
		</SimpleModal>
	);
}

function OrganisationDetailsModal({
	org,
	isSuperAdmin,
	isManager,
	onClose,
	onReload,
	persons,
	personsLoading,
	onDeleteOrganization,
	deleting,
}: {
	org: OrganisationDetails;
	isSuperAdmin: boolean;
	isManager: boolean;
	onClose: () => void;
	onReload: () => void;
	persons: MemberOption[];
	personsLoading: boolean;
	onDeleteOrganization: (iri: string) => Promise<void>;
	deleting: boolean;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const { success: toastSuccess, error: toastError } = useToast();

	const canEditLabel = isSuperAdmin;
	const canEditOwner = isSuperAdmin;
	const canManageMembers = isSuperAdmin || isManager;

	const [label, setLabel] = useState(org.label ?? "");
	const [owner, setOwner] = useState(org.owner);
	const [initialMembers, setInitialMembers] = useState<string[]>([]);
	const [members, setMembers] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const { t } = useTranslation();

	const { data: memberList = [], isFetching: membersLoading } =
		useOrganizationMembers(org.iri, {
			enabled: true,
		});

	useEffect(() => {
		const ids = memberList.map((member: any) => member.iri);
		setInitialMembers(ids);
		setMembers(ids);
	}, [memberList]);

	const handleSubmit = async () => {
		if (saving) return false;
		setSaving(true);
		try {
			const payload: Record<string, unknown> = {};
			if (canEditLabel && label !== org.label) payload.label = label;
			if (canEditOwner && owner !== org.owner) payload.ownerIri = owner;

			if (Object.keys(payload).length > 0) {
				await api(`/organizations/${encodeURIComponent(org.iri)}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
			}

			if (canManageMembers) {
				const toAdd = members.filter(
					(member) => !initialMembers.includes(member)
				);
				const toRemove = initialMembers.filter(
					(member) => !members.includes(member)
				);

				for (const memberId of toAdd) {
					await api(`/organizations/${encodeURIComponent(org.iri)}/members`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ userIri: memberId }),
					});
				}

				for (const memberId of toRemove) {
					await api(
						`/organizations/${encodeURIComponent(
							org.iri
						)}/members/${encodeURIComponent(memberId)}`,
						{ method: "DELETE" }
					);
				}
			}

			toastSuccess("Organisation mise à jour.");
			await queryClient.invalidateQueries({
				queryKey: ["organizations", "members", org.iri],
			});
			onReload();
			setSaving(false);
			return true;
		} catch (error) {
			console.error(error);
			toastError("Impossible de mettre à jour l’organisation.");
			setSaving(false);
			return false;
		}
	};

	const memberOptions = useMemo(() => persons, [persons]);
	const availableMembers = useMemo(
		() => new Set(memberOptions.map((option) => option.id)),
		[memberOptions]
	);

	useEffect(() => {
		if (!canManageMembers) return;
		setMembers((prev) => prev.filter((member) => availableMembers.has(member)));
	}, [availableMembers, canManageMembers]);

	return (
		<SimpleModal
			title="Organisation"
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={saving}
			submitLabel={saving ? "Enregistrement…" : "Sauvegarder"}>
			<div className="form-grid">
				<div className="form-field form-field--floating">
					<input
						id="org-details-name"
						className="form-input"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder=" "
						autoComplete="off"
						disabled={!canEditLabel}
					/>
					<label
						className="form-label form-label--floating"
						htmlFor="org-details-name">
						Nom de l’organisation
					</label>
				</div>

				<div className="form-field">
					<label
						className="form-label form-label--static"
						htmlFor="org-details-owner">
						Administrateur principal
					</label>
					<select
						id="org-details-owner"
						className="form-input"
						value={owner}
						onChange={(event) => setOwner(event.target.value)}
						disabled={!canEditOwner || personsLoading}>
						{memberOptions.map((person) => (
							<option key={person.id} value={person.id}>
								{person.label}
							</option>
						))}
					</select>
				</div>

				<div className="modal-section">
					<div className="modal-section__header">
						<label
							className="form-label form-label--static"
							htmlFor="org-details-members">
							Membres
						</label>
						<span className="entity-card__meta">
							{members.length} membre{members.length > 1 ? "s" : ""}
						</span>
					</div>
					{canManageMembers ? (
						<MemberSelector
							options={memberOptions}
							selectedIds={members}
							onChange={setMembers}
							selectedTitle="Membres actuels"
							availableTitle="Utilisateurs disponibles"
							emptyAvailableLabel={
								membersLoading ? "Chargement…" : "Aucun utilisateur"
							}
						/>
					) : (
						<ul className="member-list" id="org-details-members">
							{membersLoading && (
								<li className="member-list__item">Chargement…</li>
							)}
							{!membersLoading && members.length === 0 && (
								<li className="member-list__item">
									Aucun membre pour l’instant.
								</li>
							)}
							{!membersLoading &&
								members.map((memberId) => {
									const person = memberOptions.find(
										(option) => option.id === memberId
									);
									return (
										<li key={memberId} className="member-list__item">
											<span>{person?.label ?? formatLabel(memberId)}</span>
											{person?.subtitle && (
												<span className="member-list__meta">
													{person.subtitle}
												</span>
											)}
										</li>
									);
								})}
						</ul>
					)}
				</div>

				{isSuperAdmin && (
					<div className="modal-toolbar">
						<button
							type="button"
							className="button button--outline button--danger"
							disabled={deleting}
							onClick={async () => {
								try {
									await onDeleteOrganization(org.iri);
									onReload();
									onClose();
								} catch (error) {
									/* notification gérée côté mutation */
								}
							}}>
							{deleting ? "Suppression…" : "Supprimer l’organisation"}
						</button>
					</div>
				)}
			</div>
		</SimpleModal>
	);
}
