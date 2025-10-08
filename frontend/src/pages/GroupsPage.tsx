import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	usePersons,
	useProfile,
} from "../hooks/apiQueries";
import { useToast } from "../hooks/toast";
import { useTranslation } from "../language/useTranslation";
import {
	buildPersonIndex,
	getPersonDisplay,
	type PersonDetails,
} from "../utils/personOptions";
import { useSearchPagination } from "../hooks/useSearchPagination";

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

type PersonIndex = Map<string, PersonDetails>;

type GroupModalState =
	| { mode: "create" }
	| { mode: "edit"; group: GroupDetails };

type GroupModalProps = {
	state: GroupModalState;
	currentUserIri: string;
	organizations: { iri: string; label: string }[];
	organizationsLoading: boolean;
	personIndex: PersonIndex;
	isSubmitting: boolean;
	deleting: boolean;
	onCreate: (input: CreateGroupInput) => Promise<void>;
	onDeleteGroup: (iri: string) => Promise<void>;
	onReload: () => void;
	onClose: () => void;
};

function GroupModal({
	state,
	currentUserIri,
	organizations,
	organizationsLoading,
	personIndex,
	isSubmitting,
	deleting,
	onCreate,
	onDeleteGroup,
	onReload,
	onClose,
}: GroupModalProps) {
	const isCreate = state.mode === "create";
	const group = state.mode === "edit" ? state.group : null;

	const api = useApi();
	const queryClient = useQueryClient();
	const { success: toastSuccess, error: toastError } = useToast();
	const { t } = useTranslation();

	const [label, setLabel] = useState<string>(() =>
		isCreate ? "" : group?.label ?? ""
	);
	const [selectedOrg, setSelectedOrg] = useState<string>(() =>
		isCreate ? organizations[0]?.iri ?? "" : group?.organizationIri ?? ""
	);
	const [members, setMembers] = useState<string[]>(() =>
		isCreate ? [] : group?.members ?? []
	);
	const [saving, setSaving] = useState(false);
	const initialMembersRef = useRef<string[]>(group?.members ?? []);

	useEffect(() => {
		if (state.mode === "create") {
			setLabel("");
			setMembers([]);
			setSelectedOrg(organizations[0]?.iri ?? "");
			initialMembersRef.current = [];
		} else {
			const nextGroup = state.group;
			setLabel(nextGroup.label ?? "");
			setSelectedOrg(nextGroup.organizationIri ?? "");
			setMembers(nextGroup.members ?? []);
			initialMembersRef.current = nextGroup.members ?? [];
		}
		setSaving(false);
	}, [state, organizations]);

	useEffect(() => {
		if (!isCreate) return;
		if (selectedOrg) return;
		if (organizations.length === 0) return;
		setSelectedOrg(organizations[0].iri);
	}, [isCreate, organizations, selectedOrg]);

	const { data: orgMembers = [], isFetching } = useOrganizationMembers(
		selectedOrg,
		{
			enabled: Boolean(selectedOrg),
		}
	);

	const memberOptions = useMemo(
		() => mapMembersToOptions(orgMembers, personIndex),
		[orgMembers, personIndex]
	);

	useEffect(() => {
		const available = new Set(memberOptions.map((option) => option.id));
		setMembers((prev) => {
			const filtered = prev.filter((id) => available.has(id));
			let next = filtered;
			if (
				isCreate &&
				currentUserIri &&
				available.has(currentUserIri) &&
				!filtered.includes(currentUserIri)
			) {
				next = [...filtered, currentUserIri];
			}
			if (
				next.length === prev.length &&
				next.every((value, index) => value === prev[index])
			) {
				return prev;
			}
			return next;
		});
	}, [memberOptions, isCreate, currentUserIri]);

	const creatorDisplay =
		!isCreate && group?.createdBy
			? getPersonDisplay(personIndex, group.createdBy)
			: undefined;
	const isOwner = !isCreate && group?.createdBy === currentUserIri;

	const disableSubmit = isCreate
		? label.trim() === "" ||
		  selectedOrg === "" ||
		  members.length === 0 ||
		  isSubmitting
		: saving;

	const submitLabel = isCreate
		? isSubmitting
			? t("groups.form.submitting")
			: t("groups.form.submit")
		: saving
		? t("groups.details.saving")
		: t("common.done");

	const title = isCreate ? t("groups.form.title") : t("groups.details.title");

	const handleSubmit = async () => {
		if (isCreate) {
			if (label.trim() === "" || selectedOrg === "" || members.length === 0) {
				return false;
			}
			try {
				await onCreate({
					label: label.trim(),
					organizationIri: selectedOrg,
					members,
				});
				return true;
			} catch (error) {
				console.error(error);
				return false;
			}
		}

		if (!group) return false;
		if (saving) return false;
		setSaving(true);
		try {
			if (isOwner && label !== (group.label ?? "")) {
				await api(`/groups/${encodeURIComponent(group.iri)}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ label }),
				});
			}

			if (
				isOwner &&
				selectedOrg &&
				selectedOrg !== (group.organizationIri ?? "")
			) {
				await api(`/groups/${encodeURIComponent(group.iri)}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ organizationIri: selectedOrg }),
				});
			}

			const toAdd = members.filter(
				(member) => !initialMembersRef.current.includes(member)
			);
			const toRemove = initialMembersRef.current.filter(
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

			toastSuccess(t("groups.toast.updateSuccess"));
			await queryClient.invalidateQueries({
				queryKey: ["organizations", "members", selectedOrg],
			});
			onReload();
			initialMembersRef.current = members;
			setSaving(false);
			return true;
		} catch (error) {
			console.error(error);
			toastError(t("groups.toast.updateError"));
			setSaving(false);
			return false;
		}
	};

	return (
		<SimpleModal
			title={title}
			size={isCreate ? "md" : "lg"}
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={disableSubmit}
			submitLabel={submitLabel}>
			<div className="form-grid">
				<div className="form-field">
					<label
						className="form-label form-label--static"
						htmlFor="group-organization">
						{t("groups.details.organization")}
					</label>
					<select
						id="group-organization"
						className="form-input"
						value={selectedOrg}
						onChange={(event) => setSelectedOrg(event.target.value)}
						disabled={
							isCreate
								? organizationsLoading || organizations.length === 0
								: !isOwner
						}>
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
						disabled={!isCreate && !isOwner}
					/>
					<label
						className="form-label form-label--floating"
						htmlFor="group-name">
						{t("groups.form.nameLabel")}
					</label>
				</div>

				<div className="modal-section">
					<div className="modal-section__header">
						<label
							className="form-label form-label--static"
							htmlFor="group-members">
							{t("groups.details.members")}
						</label>
						<span className="entity-card__meta">
							{t("groups.card.memberCount", { count: members.length })}
						</span>
					</div>
					{selectedOrg ? (
						<>
							{isCreate && (
								<p className="form-helper">{t("groups.members.helper")}</p>
							)}
							<MemberSelector
								options={memberOptions}
								selectedIds={members}
								onChange={setMembers}
								selectedTitle={t("memberSelector.selectedTitle")}
								availableTitle={t("memberSelector.availableTitle")}
								emptyAvailableLabel={
									isFetching
										? t("groups.form.loadingMembers")
										: t("groups.form.noMembers")
								}
							/>
						</>
					) : (
						<p className="form-helper">
							{t("groups.members.selectOrganization")}
						</p>
					)}
				</div>
			</div>
		</SimpleModal>
	);
}

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

	const personsQuery = usePersons({ enabled: rolesLoaded });
	const personIndex = useMemo(
		() => buildPersonIndex(personsQuery.data ?? []),
		[personsQuery.data]
	);
	const [modalState, setModalState] = useState<GroupModalState | null>(null);

	const filterGroup = useCallback(
		(group: Group, term: string) => {
			const label = formatLabel(group.label ?? group.iri).toLowerCase();
			const organizationLabel = group.organizationIri
				? (organizationLabelMap.get(group.organizationIri) ??
						formatLabel(group.organizationIri)
				  ).toLowerCase()
				: "";
			return label.includes(term) || organizationLabel.includes(term);
		},
		[organizationLabelMap]
	);

	const {
		searchTerm,
		setSearchTerm,
		page,
		setPage,
		totalPages,
		filteredItems: filteredGroups,
		paginatedItems: paginatedGroups,
	} = useSearchPagination(groups, { filter: filterGroup });

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
			toastError(t("groups.toast.createError"));
		},
		onSuccess: () => {
			toastSuccess(t("groups.toast.createSuccess"));
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
			toastError(t("groups.toast.deleteError"));
		},
		onSuccess: () => {
			toastSuccess(t("groups.toast.deleteSuccess"));
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["groups"] });
		},
	});

	const isLoading = groupsQuery.isLoading || groupsQuery.isFetching;
	const hasGroups = groups.length > 0;
	const hasFilteredGroups = filteredGroups.length > 0;
	const paginationLabel = useMemo(
		() => t("groups.pagination.label", { page, totalPages }),
		[t, page, totalPages]
	);

	return (
		<div className="page">
			<div className="app-container page__inner">
				<header className="page-header">
					<div className="page-header__content">
						<h1 className="page-header__title">{t("groups.header.title")}</h1>
						<p className="page-header__subtitle">{t("groups.header.subtitle")}</p>
					</div>
					<div className="page-header__actions" style={{ gap: "1rem" }}>
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder={t("groups.search.placeholder")}
							className="form-input"
							style={{ minWidth: "220px" }}
						/>
						<span className="entity-chip">
							<i className="fas fa-layer-group" aria-hidden="true" />
							{t("groups.summary", { count: filteredGroups.length })}
						</span>
						{currentUserIri && (
							<button
								type="button"
								className="button button--primary"
								onClick={() => setModalState({ mode: "create" })}>
								<i className="fas fa-users" aria-hidden="true" />
								{t("groups.button.create")}
							</button>
						)}
					</div>
				</header>

				{isLoading && (
					<div className="page-state">
						<div className="page-state__spinner" aria-hidden="true" />
						<p className="page-state__text">{t("groups.state.loading")}</p>
					</div>
				)}

				{!isLoading && !hasGroups && (
					<div className="page-empty">
						<p>{t("groups.empty.title")}</p>
						<p>{t("groups.empty.subtitle")}</p>
					</div>
				)}

				{!isLoading && hasGroups && !hasFilteredGroups && (
					<div className="note-box">{t("groups.list.emptySearch")}</div>
				)}

				{!isLoading && hasGroups && hasFilteredGroups && (
					<ul className="entity-grid">
						{paginatedGroups.map((group: Group) => {
							const organizationLabel = group.organizationIri
								? organizationLabelMap.get(group.organizationIri) ??
								  formatLabel(group.organizationIri)
								: t("groups.organization.unknown");
							const memberCount = group.members?.length ?? 0;
							const creatorDisplay = getPersonDisplay(
								personIndex,
								group.createdBy
							);
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
												onClick={() =>
													setModalState({ mode: "edit", group: { ...group } })
												}
												aria-label={t("groups.actions.view")}>
												<i className="fas fa-eye" aria-hidden="true" />
											</button>
											{group.createdBy === currentUserIri && (
												<button
													title={t("groups.actions.delete")}
													type="button"
													className="icon-button icon-button--danger"
													aria-label={t("groups.actions.delete")}
													disabled={deleteGroupMutation.isPending}
													onClick={() => {
														if (!window.confirm(t("groups.confirm.delete")))
															return;
														deleteGroupMutation.mutate({ iri: group.iri });
													}}>
													<i className="fas fa-trash" aria-hidden="true" />
												</button>
											)}
										</div>
									</div>
									<div className="entity-card__footer">
										<span className="entity-chip">
											<i className="fas fa-user-friends" aria-hidden="true" />
											{t("groups.card.memberCount", { count: memberCount })}
										</span>
										{group.createdBy && creatorDisplay && (
											<span className="entity-card__meta">
												{t("groups.card.createdBy", {
													name: creatorDisplay.name,
												})}
												{creatorDisplay.email && (
													<span className="entity-card__meta-sub">
														{creatorDisplay.email}
													</span>
												)}
											</span>
										)}
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{modalState && (
				<GroupModal
					state={modalState}
					currentUserIri={currentUserIri ?? ""}
					organizations={organizations}
					organizationsLoading={organizationsQuery.isLoading}
					personIndex={personIndex}
					isSubmitting={createGroupMutation.isPending}
					deleting={deleteGroupMutation.isPending}
					onCreate={async (payload) => {
						await createGroupMutation.mutateAsync(payload);
					}}
					onDeleteGroup={async (iri: string) => {
						await deleteGroupMutation.mutateAsync({ iri });
					}}
					onReload={() => {
						queryClient.invalidateQueries({ queryKey: ["groups"] });
						queryClient.invalidateQueries({
							queryKey: ["organizations", organizationsScope],
						});
					}}
					onClose={() => setModalState(null)}
				/>
			)}

			{hasFilteredGroups && totalPages > 1 && (
				<div className="pagination-bar">
					<button
						className="btn-secondary"
						onClick={() => setPage((prev) => Math.max(1, prev - 1))}
						disabled={page === 1}>
						{t("common.pagination.previous")}
					</button>
					<span className="page-section__description" style={{ fontSize: "0.9rem" }}>
						{paginationLabel}
					</span>
					<button
						className="btn-secondary"
						onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
						disabled={page >= totalPages}>
						{t("common.pagination.next")}
					</button>
				</div>
			)}
		</div>
	);
}

function mapMembersToOptions(
	members: any[],
	personIndex: PersonIndex
): MemberOption[] {
	const seen = new Set<string>();
	const options: MemberOption[] = [];
	members.forEach((member: any) => {
		const id: string | undefined = member.id ?? member.iri;
		if (!id || seen.has(id)) return;
		seen.add(id);

		const person = personIndex.get(id);
		const display = getPersonDisplay(personIndex, id);
		const properties = member.properties ?? [];
		const emailFromMember: string | undefined = properties.find((prop: any) =>
			prop.predicate?.toLowerCase().endsWith("#email")
		)?.value;
		const nameFromMember: string | undefined = properties.find((prop: any) =>
			prop.predicate?.toLowerCase().endsWith("#name")
		)?.value;
		const fallback =
			member.label ?? display?.name ?? id.split(/[#/]/).pop() ?? id;

		options.push({
			id,
			label: person?.name ?? nameFromMember ?? fallback,
			subtitle: person?.email ?? emailFromMember ?? display?.email,
		});
	});
	return options;
}
