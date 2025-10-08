import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
	buildPersonIndex,
	getPersonDisplay,
	personsToMemberOptions,
	type PersonDetails,
} from "../utils/personOptions";
import { useSearchPagination } from "../hooks/useSearchPagination";

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

type PersonIndex = Map<string, PersonDetails>;

type OrganisationModalState =
	| { mode: "create" }
	| {
			mode: "edit";
			organization: OrganisationDetails;
			canEditLabel: boolean;
			canEditOwner: boolean;
			canManageMembers: boolean;
	  };

type OrganisationModalProps = {
	state: OrganisationModalState;
	personOptions: MemberOption[];
	personIndex: PersonIndex;
	personsLoading: boolean;
	isSubmitting: boolean;
	deleting: boolean;
	onCreate: (input: CreateOrganizationInput) => Promise<void>;
	onDeleteOrganization: (iri: string) => Promise<void>;
	onReload: () => void;
	onClose: () => void;
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
	const personOptions = useMemo(
		() => personsToMemberOptions(personsQuery.data ?? []),
		[personsQuery.data]
	);
	const personIndex: PersonIndex = useMemo(
		() => buildPersonIndex(personsQuery.data ?? []),
		[personsQuery.data]
	);

	const [modalState, setModalState] = useState<OrganisationModalState | null>(
		null
	);

	const filterOrganization = useCallback(
		(organization: Organisation, term: string) => {
			const label = formatLabel(organization.label ?? organization.iri).toLowerCase();
			const ownerDetails = getPersonDisplay(personIndex, organization.owner);
			const ownerLabel = ownerDetails?.name?.toLowerCase() ?? "";
			return label.includes(term) || ownerLabel.includes(term);
		},
		[personIndex]
	);

	const {
		searchTerm,
		setSearchTerm,
		page,
		setPage,
		totalPages,
		filteredItems: filteredOrganizations,
		paginatedItems: paginatedOrganizations,
	} = useSearchPagination(organizations, { filter: filterOrganization });

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
			toastError(t("organizations.toast.createError"));
		},
		onSuccess: () => toastSuccess(t("organizations.toast.createSuccess")),
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
			toastError(t("organizations.toast.deleteError"));
		},
		onSuccess: () => toastSuccess(t("organizations.toast.deleteSuccess")),
		onSettled: () => refreshOrganizations(),
	});

	const isLoading =
		organizationsQuery.isLoading || organizationsQuery.isFetching;
	const hasOrganizations = organizations.length > 0;
	const hasFilteredOrganizations = filteredOrganizations.length > 0;
	const paginationLabel = useMemo(
		() => t("organizations.pagination.label", { page, totalPages }),
		[t, page, totalPages]
	);

	return (
		<div className="page">
			<div className="app-container page__inner">
				<header className="page-header">
					<div>
						<h1 className="page-title">{t("organizations.header.title")}</h1>
						<p className="page-subtitle">
							{t("organizations.header.subtitle")}
						</p>
					</div>
					<div className="page-header__actions" style={{ gap: "1rem" }}>
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder={t("organizations.search.placeholder")}
							className="form-input"
							style={{ minWidth: "220px" }}
						/>
						<span className="entity-chip">
							<i className="fas fa-building" aria-hidden="true" />
							{t("organizations.summary", { count: filteredOrganizations.length })}
						</span>
						{isSuperAdmin && (
							<button
								type="button"
								className="button button--primary"
								onClick={() => setModalState({ mode: "create" })}>
								<i className="fas fa-building" aria-hidden="true" />
								{t("organizations.button.create")}
							</button>
						)}
					</div>
				</header>

				{isLoading && (
					<div className="page-state">
						<div className="page-state__spinner" aria-hidden="true" />
						<p className="page-state__text">
							{t("organizations.state.loading")}
						</p>
					</div>
				)}

				{!isLoading && !hasOrganizations && (
					<div className="page-empty">
						<p>{t("organizations.empty.title")}</p>
						<p>{t("organizations.empty.subtitle")}</p>
					</div>
				)}

				{!isLoading && hasOrganizations && !hasFilteredOrganizations && (
					<div className="note-box">{t("organizations.list.emptySearch")}</div>
				)}

				{!isLoading && hasOrganizations && hasFilteredOrganizations && (
					<ul className="entity-grid">
						{paginatedOrganizations.map((organization) => {
							const ownerDisplay = getPersonDisplay(
								personIndex,
								organization.owner
							);
							const ownerLabel =
								ownerDisplay?.name ?? formatLabel(organization.owner);
							const createdAt = new Date(organization.createdAt);
							return (
								<li key={organization.iri} className="entity-card">
									<div className="entity-card__header">
										<div>
											<h3 className="entity-card__title">
												{formatLabel(organization.label ?? organization.iri)}
											</h3>
											<p className="entity-card__subtitle">
												{t("organizations.card.admin", { name: ownerLabel })}
											</p>
										</div>
										<div className="entity-card__actions">
											<button
												type="button"
												className="icon-button"
												title={t("organizations.actions.view")}
												aria-label={t("organizations.actions.view")}
												onClick={() => {
													const canManageMembers =
														isSuperAdmin ||
														organization.owner === currentUserIri;
													setModalState({
														mode: "edit",
														organization: { ...organization },
														canEditLabel: isSuperAdmin,
														canEditOwner: isSuperAdmin,
														canManageMembers,
													});
												}}>
												<i className="fas fa-eye" aria-hidden="true" />
											</button>
											{isSuperAdmin && (
												<button
													type="button"
													className="icon-button icon-button--danger"
													title={t("common.delete")}
													aria-label={t("common.delete")}
													disabled={deleteOrganizationMutation.isPending}
													onClick={() => {
														if (
															!window.confirm(t("organizations.confirm.delete"))
														)
															return;
														deleteOrganizationMutation.mutate({
															iri: organization.iri,
														});
													}}>
													<i className="fas fa-trash" aria-hidden="true" />
												</button>
											)}
										</div>
									</div>
									<div className="entity-card__footer">
										<span className="entity-chip">
											<i className="fas fa-calendar" aria-hidden="true" />
											{t("organizations.card.createdAt", {
												date: createdAt.toLocaleDateString(),
											})}
										</span>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{modalState && (
				<OrganisationModal
					state={modalState}
					personOptions={personOptions}
					personIndex={personIndex}
					personsLoading={personsQuery.isLoading}
					isSubmitting={createOrganizationMutation.isPending}
					deleting={deleteOrganizationMutation.isPending}
					onCreate={async (payload) => {
						await createOrganizationMutation.mutateAsync(payload);
					}}
					onDeleteOrganization={async (iri) => {
						await deleteOrganizationMutation.mutateAsync({ iri });
					}}
					onReload={refreshOrganizations}
					onClose={() => setModalState(null)}
				/>
			)}

			{hasFilteredOrganizations && totalPages > 1 && (
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

function OrganisationModal({
	state,
	personOptions,
	personIndex,
	personsLoading,
	isSubmitting,
	deleting,
	onCreate,
	onDeleteOrganization,
	onReload,
	onClose,
}: OrganisationModalProps) {
	if (state.mode === "create") {
		return (
			<CreateOrganisationModal
				onClose={onClose}
				onCreate={onCreate}
				personOptions={personOptions}
				personIndex={personIndex}
				personsLoading={personsLoading}
				isSubmitting={isSubmitting}
			/>
		);
	}

	return (
		<EditOrganisationModal
			organisation={state.organization}
			canEditLabel={state.canEditLabel}
			canEditOwner={state.canEditOwner}
			canManageMembers={state.canManageMembers}
			onClose={onClose}
			onReload={onReload}
			personOptions={personOptions}
			personIndex={personIndex}
			personsLoading={personsLoading}
			onDeleteOrganization={onDeleteOrganization}
			deleting={deleting}
		/>
	);
}

function CreateOrganisationModal({
	onClose,
	onCreate,
	personOptions,
	personIndex,
	personsLoading,
	isSubmitting,
}: {
	onClose: () => void;
	onCreate: (input: CreateOrganizationInput) => Promise<void>;
	personOptions: MemberOption[];
	personIndex: PersonIndex;
	personsLoading: boolean;
	isSubmitting: boolean;
}) {
	const [label, setLabel] = useState("");
	const [owner, setOwner] = useState<string>("");

	const disabled = label.trim() === "" || owner === "";
	const { t } = useTranslation();
	const selectedOwner = owner
		? getPersonDisplay(personIndex, owner)
		: undefined;

	const handleSubmit = async () => {
		if (disabled) return false;
		try {
			await onCreate({ label: label.trim(), ownerIri: owner });
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	};

	return (
		<SimpleModal
			title={t("organizations.form.title")}
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={disabled || isSubmitting}
			size="lg"
			submitLabel={
				isSubmitting
					? t("organizations.form.submitting")
					: t("organizations.form.submit")
			}>
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
						{t("organizations.form.nameLabel")}
					</label>
				</div>

				<div className="form-field">
					<label className="form-label form-label--static" htmlFor="org-owner">
						{t("organizations.form.ownerLabel")}
					</label>
					<select
						id="org-owner"
						className="form-input"
						value={owner}
						onChange={(event) => setOwner(event.target.value)}
						disabled={personsLoading}>
						<option value="">{t("organizations.form.selectOwner")}</option>
						{personOptions.map((person) => (
							<option key={person.id} value={person.id}>
								{person.label}
							</option>
						))}
					</select>
					{selectedOwner?.email && (
						<p className="form-meta">{selectedOwner.email}</p>
					)}
				</div>
			</div>
		</SimpleModal>
	);
}

function EditOrganisationModal({
	organisation,
	canEditLabel,
	canEditOwner,
	canManageMembers,
	onClose,
	onReload,
	personOptions,
	personIndex,
	personsLoading,
	onDeleteOrganization,
	deleting,
}: {
	organisation: OrganisationDetails;
	canEditLabel: boolean;
	canEditOwner: boolean;
	canManageMembers: boolean;
	onClose: () => void;
	onReload: () => void;
	personOptions: MemberOption[];
	personIndex: PersonIndex;
	personsLoading: boolean;
	onDeleteOrganization: (iri: string) => Promise<void>;
	deleting: boolean;
}) {
	const api = useApi();
	const queryClient = useQueryClient();
	const { success: toastSuccess, error: toastError } = useToast();
	const { t } = useTranslation();

	const [label, setLabel] = useState(organisation.label ?? "");
	const [owner, setOwner] = useState(organisation.owner);
	const [initialMembers, setInitialMembers] = useState<string[]>([]);
	const [members, setMembers] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);

	const { data: memberList = [], isFetching: membersLoading } =
		useOrganizationMembers(organisation.iri, { enabled: true });

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
			if (canEditLabel && label !== organisation.label) payload.label = label;
			if (canEditOwner && owner !== organisation.owner)
				payload.ownerIri = owner;

			if (Object.keys(payload).length > 0) {
				await api(`/organizations/${encodeURIComponent(organisation.iri)}`, {
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
					await api(
						`/organizations/${encodeURIComponent(organisation.iri)}/members`,
						{
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ userIri: memberId }),
						}
					);
				}

				for (const memberId of toRemove) {
					await api(
						`/organizations/${encodeURIComponent(
							organisation.iri
						)}/members/${encodeURIComponent(memberId)}`,
						{ method: "DELETE" }
					);
				}
			}

			toastSuccess(t("organizations.toast.updateSuccess"));
			await queryClient.invalidateQueries({
				queryKey: ["organizations", "members", organisation.iri],
			});
			onReload();
			setSaving(false);
			return true;
		} catch (error) {
			console.error(error);
			toastError(t("organizations.toast.updateError"));
			setSaving(false);
			return false;
		}
	};

	const availableMembers = useMemo(
		() => new Set(personOptions.map((option) => option.id)),
		[personOptions]
	);

	useEffect(() => {
		if (!canManageMembers) return;
		setMembers((prev) => {
			const filtered = prev.filter((member) => availableMembers.has(member));
			if (
				filtered.length === prev.length &&
				filtered.every((id, idx) => id === prev[idx])
			) {
				return prev;
			}
			return filtered;
		});
	}, [availableMembers, canManageMembers]);

	const ownerDisplay = owner ? getPersonDisplay(personIndex, owner) : undefined;

	return (
		<SimpleModal
			title={t("organizations.details.title")}
			size="lg"
			onClose={onClose}
			onSubmit={handleSubmit}
			disableSubmit={saving}
			submitLabel={
				saving ? t("organizations.details.saving") : t("common.save")
			}>
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
						{t("organizations.form.nameLabel")}
					</label>
				</div>

				<div className="form-field">
					<label
						className="form-label form-label--static"
						htmlFor="org-details-owner">
						{t("organizations.form.ownerLabel")}
					</label>
					<select
						id="org-details-owner"
						className="form-input"
						value={owner}
						onChange={(event) => setOwner(event.target.value)}
						disabled={!canEditOwner || personsLoading}>
						{personOptions.map((person) => (
							<option key={person.id} value={person.id}>
								{person.label}
							</option>
						))}
					</select>
					{ownerDisplay?.email && (
						<p className="form-meta">{ownerDisplay.email}</p>
					)}
				</div>

				<div className="modal-section">
					<div className="modal-section__header">
						<label
							className="form-label form-label--static"
							htmlFor="org-details-members">
							{t("groups.details.members")}
						</label>
						<span className="entity-card__meta">
							{t("groups.card.memberCount", { count: members.length })}
						</span>
					</div>
					{canManageMembers ? (
						<>
							<p className="form-helper">{t("organizations.members.helper")}</p>
							<MemberSelector
								options={personOptions}
								selectedIds={members}
								onChange={setMembers}
								selectedTitle={t("memberSelector.selectedTitle")}
								availableTitle={t("memberSelector.availableTitle")}
								emptyAvailableLabel={
									membersLoading
										? t("groups.form.loadingMembers")
										: t("organizations.members.emptyAvailable")
								}
							/>
						</>
					) : (
						<>
							<p className="form-helper">
								{t("organizations.members.readonly")}
							</p>
							<ul className="member-list" id="org-details-members">
								{membersLoading && (
									<li className="member-list__item">{t("common.loading")}</li>
								)}
								{!membersLoading && members.length === 0 && (
									<li className="member-list__item">
										{t("organizations.details.noMembers")}
									</li>
								)}
								{!membersLoading &&
									members.map((memberId) => {
										const details = getPersonDisplay(personIndex, memberId);
										return (
											<li key={memberId} className="member-list__item">
												<span>{details?.name ?? formatLabel(memberId)}</span>
												{details?.email && (
													<span className="member-list__meta">
														{details.email}
													</span>
												)}
											</li>
										);
									})}
							</ul>
						</>
					)}
				</div>
			</div>
		</SimpleModal>
	);
}
