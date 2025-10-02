import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import SimpleModal from "../components/SimpleModal";
import { MemberSelector, MemberOption } from "../components/members";
import { useApi } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { formatLabel } from "../utils/formatLabel";
import {
	useGroups,
	useOrganizationMembers,
	useOrganizations,
	useProfile,
} from "../hooks/apiQueries";
import { useToast } from "../hooks/toast";
import { useTranslation } from "../language/useTranslation";

type Group = {
	iri: string;
	label?: string;
	members: string[];
	createdBy?: string;
	organizationIri?: string;
};

type GroupDetails = Group & { organizationIri?: string };

type CreateGroupInput = {
	label: string;
	organizationIri: string;
	members: string[];
};

type DeleteGroupInput = { iri: string };

type GroupsMutationContext = {
	previousGroups: Group[];
};

export default function GroupsPage() {
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

	const groupsQuery = useGroups();
	const rawGroups = groupsQuery.data ?? [];
	const groups = useMemo<Group[]>(
		() =>
			rawGroups.map((group: any) => ({
				iri: group.iri,
				label: group.label,
				createdBy: group.createdBy,
				members: group.members ?? [],
				organizationIri: group.organizationIri,
			})),
		[rawGroups]
	);

	const organizationsScope = isSuperAdmin ? "all" : "mine";
	const organizationsQuery = useOrganizations(organizationsScope, {
		enabled: rolesLoaded,
	});
	const organizations = useMemo(
		() =>
			(organizationsQuery.data ?? []).map((org: any) => ({
				iri: org.iri,
				label: org.label ?? formatLabel(org.iri),
			})),
		[organizationsQuery.data]
	);
	const organizationLabelMap = useMemo(() => {
		const map = new Map<string, string>();
		organizations.forEach((org) => map.set(org.iri, org.label));
		return map;
	}, [organizations]);

	const [showCreateModal, setShowCreateModal] = useState(false);
	const [focusedGroup, setFocusedGroup] = useState<GroupDetails | null>(null);

	const createGroupMutation = useMutation<
		string | undefined,
		Error,
		CreateGroupInput,
		GroupsMutationContext
	>({
		mutationFn: async ({ label, organizationIri, members }) => {
			const response = await api("/groups", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ label, organizationIri, members }),
			});
			if (!response.ok) {
				throw new Error(await response.text());
			}
			const contentType = response.headers.get("content-type");
			if (contentType?.includes("application/json")) {
				const json = await response.json();
				return typeof json === "string" ? json : json?.iri;
			}
			return (await response.text()) || undefined;
		},
		onMutate: async (input) => {
			await queryClient.cancelQueries({ queryKey: ["groups"] });
			const previousGroups = (
				queryClient.getQueryData<Group[]>(["groups"]) ?? []
			).slice();
			const optimistic: Group = {
				iri: `temp-${Date.now()}`,
				label: input.label,
				organizationIri: input.organizationIri,
				createdBy: currentUserIri,
				members: input.members,
			};
			queryClient.setQueryData<Group[]>(
				["groups"],
				[...previousGroups, optimistic]
			);
			return { previousGroups };
		},
		onError: (_error, _input, context) => {
			if (context) {
				queryClient.setQueryData<Group[]>(["groups"], context.previousGroups);
			}
			toastError("Impossible de créer le groupe.");
		},
		onSuccess: () => {
			toastSuccess("Groupe créé avec succès.");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["groups"] });
			queryClient.invalidateQueries({
				queryKey: ["organizations", organizationsScope],
			});
		},
	});

	const deleteGroupMutation = useMutation<
		void,
		Error,
		DeleteGroupInput,
		GroupsMutationContext
	>({
		mutationFn: async ({ iri }) => {
			const response = await api(`/groups/${encodeURIComponent(iri)}`, {
				method: "DELETE",
			});
			if (!response.ok) throw new Error(await response.text());
		},
		onMutate: async ({ iri }) => {
			await queryClient.cancelQueries({ queryKey: ["groups"] });
			const previousGroups = (
				queryClient.getQueryData<Group[]>(["groups"]) ?? []
			).slice();
			queryClient.setQueryData<Group[]>(
				["groups"],
				previousGroups.filter((group) => group.iri !== iri)
			);
			return { previousGroups };
		},
		onError: (_error, _input, context) => {
			if (context) {
				queryClient.setQueryData<Group[]>(["groups"], context.previousGroups);
			}
			toastError("Suppression du groupe impossible.");
		},
		onSuccess: () => {
			toastSuccess("Groupe supprimé.");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["groups"] });
		},
	});

	const isLoading = groupsQuery.isLoading || groupsQuery.isFetching;
	const hasGroups = groups.length > 0;

	return (
		<div className="page">
			<div className="app-container page__inner">
				<header className="page-header">
					<div>
						<h1 className="page-title">Groupes</h1>
						<p className="page-subtitle">
							Organisez vos collaborateurs en espaces de travail dédiés et
							contrôlez l’accès aux ontologies partagées.
							{t("groups.title", { count: groups.length })}
						</p>
					</div>
					{currentUserIri && (
						<button
							type="button"
							className="button button--primary"
							onClick={() => setShowCreateModal(true)}>
							<i className="fas fa-users" aria-hidden="true" />
							{t("groups.actions.new")}
						</button>
					)}
				</header>

				{isLoading && (
					<div className="page-state">
						<div className="page-state__spinner" aria-hidden="true" />
						<p className="page-state__text">Chargement des groupes…</p>
					</div>
				)}

				{!isLoading && !hasGroups && (
					<div className="page-empty">
						<p>Vous n’avez pas encore créé de groupe.</p>
						<p>Invitez vos collègues pour collaborer sur vos ontologies.</p>
					</div>
				)}

				{!isLoading && hasGroups && (
					<ul className="entity-grid">
						{groups.map((group: Group) => {
							const organizationLabel = group.organizationIri
								? organizationLabelMap.get(group.organizationIri) ??
								  formatLabel(group.organizationIri)
								: "Organisation inconnue";
							return (
								<li key={group.iri} className="entity-card">
									<div className="entity-card__header">
										<div>
											<h3 className="entity-card__title">
												{formatLabel(group.label ?? group.iri)}
											</h3>
											<p className="entity-card__subtitle">
												{organizationLabel}
											</p>
										</div>
										<div className="entity-card__actions">
											<button
												title={t("groups.actions.view")}
												type="button"
												className="icon-button"
												onClick={() => setFocusedGroup({ ...group })}
												aria-label="Voir les détails du groupe">
												<i className="fas fa-eye" aria-hidden="true" />
											</button>
											{group.createdBy === currentUserIri && (
												<button
													title={t("groups.actions.delete")}
													type="button"
													className="icon-button icon-button--danger"
													aria-label="Supprimer le groupe"
													disabled={deleteGroupMutation.isPending}
													onClick={() =>
														deleteGroupMutation.mutate({ iri: group.iri })
													}>
													<i className="fas fa-trash" aria-hidden="true" />
												</button>
											)}
										</div>
									</div>
									<div className="entity-card__footer">
										<span className="entity-chip">
											<i className="fas fa-user-friends" aria-hidden="true" />
											{group.members.length} membre
											{group.members.length > 1 ? "s" : ""}
											{t("groups.membersLabel", {
												count: group.members?.length ?? 0,
											})}
										</span>
										{group.createdBy && (
											<span className="entity-card__meta">
												Créé par {formatLabel(group.createdBy)}
											</span>
										)}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{showCreateModal && (
				<GroupFormModal
					currentUserIri={currentUserIri ?? ""}
					organizations={organizations}
					organizationsLoading={organizationsQuery.isLoading}
					isSubmitting={createGroupMutation.isPending}
					onCreate={async (payload) => {
						await createGroupMutation.mutateAsync(payload);
					}}
					onClose={() => setShowCreateModal(false)}
				/>
			)}

			{focusedGroup && (
				<GroupDetailsModal
					group={focusedGroup}
					currentUserIri={currentUserIri ?? ""}
					organizations={organizations}
					onClose={() => setFocusedGroup(null)}
					onReload={() => {
						queryClient.invalidateQueries({ queryKey: ["groups"] });
						queryClient.invalidateQueries({
							queryKey: ["organizations", organizationsScope],
						});
					}}
					onDeleteGroup={async (iri: string) => {
						await deleteGroupMutation.mutateAsync({ iri });
					}}
					deleting={deleteGroupMutation.isPending}
				/>
			)}
		</div>
	);
}

function mapMembersToOptions(members: any[]): MemberOption[] {
	return members.map((member: any) => {
		const id: string = member.id ?? member.iri;
		const email = member.properties?.find((prop: any) =>
			prop.predicate?.toLowerCase().endsWith("#email")
		)?.value;
		const name = member.label ?? id.split(/[#/]/).pop() ?? id;
		return {
			id,
			label: name,
			subtitle: email,
		};
	});
}

function GroupFormModal({
	currentUserIri,
	organizations,
	organizationsLoading,
	isSubmitting,
	onClose,
	onCreate,
}: {
	currentUserIri: string;
	organizations: { iri: string; label: string }[];
	organizationsLoading: boolean;
	isSubmitting: boolean;
	onClose: () => void;
	onCreate: (input: CreateGroupInput) => Promise<void>;
}) {
	const [label, setLabel] = useState("");
	const [selectedOrg, setSelectedOrg] = useState<string>(
		organizations[0]?.iri ?? ""
	);
	const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
	const { t } = useTranslation();

	const { data: orgMembers = [], isFetching } = useOrganizationMembers(
		selectedOrg,
		{
			enabled: Boolean(selectedOrg),
		}
	);

	const memberOptions = useMemo(
		() => mapMembersToOptions(orgMembers),
		[orgMembers]
	);

	useEffect(() => {
		const available = new Set(memberOptions.map((option) => option.id));
		setSelectedMembers((prev) => {
			const next = prev.filter((id) => available.has(id));
			if (available.has(currentUserIri) && !next.includes(currentUserIri)) {
				return [...next, currentUserIri];
			}
			return next;
		});
	}, [memberOptions, currentUserIri, selectedOrg]);

	const disabled =
		label.trim() === "" || selectedOrg === "" || selectedMembers.length === 0;

	const handleSubmit = async () => {
		if (disabled) return false;
		try {
			await onCreate({
				label: label.trim(),
				organizationIri: selectedOrg,
				members: selectedMembers,
			});
			return true;
		} catch (error) {
			return false;
		}
	};

	return (
		<SimpleModal
			title={t("groups.form.title")}
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={disabled || isSubmitting}
			submitLabel={isSubmitting ? t("common.save") : t("common.create")}>
			<div className="form-grid">
				<div className="form-field">
					<label
						className="form-label form-label--static"
						htmlFor="group-organization">
						{t("groups.form.title")}
					</label>
					<select
						id="group-organization"
						className="form-input"
						value={selectedOrg}
						onChange={(event) => {
							setSelectedOrg(event.target.value);
							setSelectedMembers([]);
						}}
						disabled={organizationsLoading || organizations.length === 0}>
						<option value="">{t("groups.form.organizationPlaceholder")}</option>
						{organizations.map((organization) => (
							<option key={organization.iri} value={organization.iri}>
								{organization.label}
							</option>
						))}
					</select>
				</div>

				<div className="form-field form-field--floating">
					<input
						id="group-name"
						className="form-input"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder=" "
						autoComplete="off"
					/>
					<label
						className="form-label form-label--floating"
						htmlFor="group-name">
						{t("groups.form.namePlaceholder")}
					</label>
				</div>

				<div className="modal-section">
					<label
						className="form-label form-label--static"
						htmlFor="group-members">
						{t("groups.form.loadingMembers")}
					</label>
					{selectedOrg ? (
						<>
							<p className="form-helper">
								Glissez-déposez ou cliquez pour sélectionner les collaborateurs
								à inclure dans le groupe.
							</p>
							<MemberSelector
								options={memberOptions}
								selectedIds={selectedMembers}
								onChange={setSelectedMembers}
								selectedTitle="Membres du groupe"
								availableTitle="Membres de l’organisation"
								emptyAvailableLabel={
									isFetching ? "Chargement…" : "Aucun membre disponible"
								}
							/>
						</>
					) : (
						<p className="form-helper">
							Sélectionnez d’abord une organisation pour choisir ses membres.
						</p>
					)}
				</div>
			</div>
		</SimpleModal>
	);
}

function GroupDetailsModal({
	group,
	currentUserIri,
	organizations,
	onClose,
	onReload,
	onDeleteGroup,
	deleting,
}: {
	group: GroupDetails;
	currentUserIri: string;
	organizations: { iri: string; label: string }[];
	onClose: () => void;
	onReload: () => void;
	onDeleteGroup: (iri: string) => Promise<void>;
	deleting: boolean;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const { success: toastSuccess, error: toastError } = useToast();

	const isOwner = group.createdBy === currentUserIri;
	const { t } = useTranslation();

	const [label, setLabel] = useState(group.label ?? "");
	const [selectedOrg, setSelectedOrg] = useState(group.organizationIri ?? "");
	const [initialMembers] = useState<string[]>(group.members ?? []);
	const [members, setMembers] = useState<string[]>(group.members ?? []);
	const [saving, setSaving] = useState(false);

	const { data: orgMembers = [], isFetching } = useOrganizationMembers(
		selectedOrg,
		{
			enabled: Boolean(selectedOrg),
		}
	);

	const memberOptions = useMemo(
		() => mapMembersToOptions(orgMembers),
		[orgMembers]
	);

	useEffect(() => {
		const available = new Set(memberOptions.map((option) => option.id));
		setMembers((prev) => prev.filter((member) => available.has(member)));
	}, [memberOptions]);

	const handleSubmit = async () => {
		if (saving) return false;
		setSaving(true);
		try {
			if (isOwner && label !== group.label) {
				await api(`/groups/${encodeURIComponent(group.iri)}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ label }),
				});
			}

			if (isOwner && selectedOrg && selectedOrg !== group.organizationIri) {
				await api(`/groups/${encodeURIComponent(group.iri)}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ organizationIri: selectedOrg }),
				});
			}

			const toAdd = members.filter(
				(member) => !initialMembers.includes(member)
			);
			const toRemove = initialMembers.filter(
				(member) => !members.includes(member)
			);

			for (const memberId of toAdd) {
				await api(`/groups/${encodeURIComponent(group.iri)}/members`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userIri: memberId }),
				});
			}

			for (const memberId of toRemove) {
				await api(
					`/groups/${encodeURIComponent(
						group.iri
					)}/members/${encodeURIComponent(memberId)}`,
					{ method: "DELETE" }
				);
			}

			toastSuccess("Groupe mis à jour.");
			await queryClient.invalidateQueries({
				queryKey: ["organizations", "members", selectedOrg],
			});
			onReload();
			setSaving(false);
			return true;
		} catch (error) {
			console.error(error);
			toastError("Impossible de mettre à jour le groupe.");
			setSaving(false);
			return false;
		}
	};

	const deletable = isOwner;

	return (
		<SimpleModal
			title={t("groups.details.title")}
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={saving}
			submitLabel={saving ? t("common.save") : t("common.done")}>
			<div className="form-grid">
				<div className="form-field form-field--floating">
					<input
						id="group-details-name"
						className="form-input"
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder=" "
						autoComplete="off"
						disabled={!isOwner}
					/>
					<label
						className="form-label form-label--floating"
						htmlFor="group-details-name">
						Nom du groupe
					</label>
				</div>

				<div className="form-field">
					<label
						className="form-label form-label--static"
						htmlFor="group-details-org">
						Organisation
					</label>
					<select
						id="group-details-org"
						className="form-input"
						value={selectedOrg}
						onChange={(event) => setSelectedOrg(event.target.value)}
						disabled={!isOwner}>
						<option value="">Choisir une organisation</option>
						{organizations.map((organization) => (
							<option key={organization.iri} value={organization.iri}>
								{organization.label}
							</option>
						))}
					</select>
				</div>

				<div className="modal-section">
					<div className="modal-section__header">
						<label
							className="form-label form-label--static"
							htmlFor="group-details-members">
							Membres
						</label>
						<span className="entity-card__meta">
							{members.length} membre{members.length > 1 ? "s" : ""}
						</span>
					</div>
					<MemberSelector
						options={memberOptions}
						selectedIds={members}
						onChange={setMembers}
						selectedTitle="Dans le groupe"
						availableTitle="Dans l’organisation"
						emptyAvailableLabel={isFetching ? "Chargement…" : "Aucun membre"}
					/>
				</div>

				{deletable && (
					<div className="modal-toolbar">
						<button
							type="button"
							className="button button--outline button--danger"
							disabled={deleting}
							onClick={async () => {
								try {
									await onDeleteGroup(group.iri);
									onReload();
									onClose();
								} catch (error) {
									/* notification déjà gérée par la mutation */
								}
							}}>
							{deleting ? "Suppression…" : "Supprimer ce groupe"}
						</button>
					</div>
				)}
			</div>
		</SimpleModal>
	);
}
