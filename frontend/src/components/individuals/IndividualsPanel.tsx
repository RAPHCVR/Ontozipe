import React, { useState, useMemo } from "react";
import { IndividualNode, CommentNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import IndividualCard from "./IndividualCard";
import { useAuth } from "../../auth/AuthContext";
import { useTranslation } from "../../language/useTranslation";

// ---------------------------------------------------------------------------
// Individuals side‑panel
// ---------------------------------------------------------------------------
const IndividualsPanel: React.FC<{
	snapshot: Snapshot;
	classId: string | null;
	focusedIndividualId?: string | null;
	onShow: (ind: IndividualNode) => void;
	onCreate: (classId: string) => void;
	onEdit: (ind: IndividualNode) => void;
	onDelete: (ind: IndividualNode) => void;
	onAddComment: (ind: IndividualNode) => void;
	width: number;
}> = ({
	snapshot,
	classId,
	focusedIndividualId,
	onShow,
	onCreate,
	onEdit,
	onDelete,
	onAddComment,
	width,
}) => {
	// ------------------------------------------------------------
	// Auth & user groups
	// ------------------------------------------------------------
	const { user } = useAuth();
	const { t } = useTranslation();
	const currentUserIri: string | undefined = user?.sub;

	const userNode =
		snapshot?.persons.find((p) => p.id === currentUserIri) || undefined;

	const userGroups =
		userNode?.groups?.map((g) => ({ iri: g.iri, label: g.label })) || [];

	// ------------------------------------------------------------
	// Local UI state
	// ------------------------------------------------------------
	const [search, setSearch] = useState("");
	const [groupFilter, setGroupFilter] = useState<string>("all");

	// ------------------------------------------------------------
	// Memos (toujours exécutés pour garder le même nombre de hooks)
	// ------------------------------------------------------------
	const baseIndividuals = useMemo(() => {
		if (!snapshot || !classId) return [];
		return snapshot.individuals.filter((ind) => ind.classId === classId);
	}, [snapshot, classId]);

	// Filtrage par groupe
	const groupFiltered = useMemo(() => {
		if (groupFilter === "all") return baseIndividuals;
		return baseIndividuals.filter((ind) =>
			(ind.visibleTo || []).includes(groupFilter)
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [baseIndividuals, groupFilter]);

	// Recherche puissante (label, propriétés, commentaires)
	const normalized = (s: string) => s.toLowerCase();
	const term = normalized(search.trim());

	const searchedIndividuals = useMemo(() => {
		if (!term) return groupFiltered;

		const inLabel: typeof groupFiltered = [];
		const inProps: typeof groupFiltered = [];

		groupFiltered.forEach((ind) => {
			const labelMatch = normalized(ind.label || "").includes(term);

			let propMatch = false;
			if (!labelMatch) {
				propMatch = (ind.properties || []).some((p) =>
					normalized(
						(p.valueLabel || p.value || "") + " " + (p.predicateLabel || "")
					).includes(term)
				);
			}

			let commentMatch = false;
			if (!labelMatch && !propMatch && snapshot?.comments) {
				commentMatch = (snapshot.comments as CommentNode[]).some(
					(c) => c.onResource === ind.id && normalized(c.body).includes(term)
				);
			}

			if (labelMatch) inLabel.push(ind);
			else if (propMatch || commentMatch) inProps.push(ind);
		});

		return [...inLabel, ...inProps];
	}, [groupFiltered, term, snapshot?.comments]);

	if (!snapshot || !classId) {
		return (
			<aside className="individuals-panel" style={{ width }}>
				<div className="card individuals-panel__card individuals-panel__card--empty">
					{t("individual.panel.selectClass")}
				</div>
			</aside>
		);
	}

	const classLabel = classId
		? formatLabel(classId.split(/[#/]/).pop() || classId)
		: "";

	return (
		<aside className="individuals-panel" style={{ width }}>
			<div className="card individuals-panel__card">
				{/* ---- FILTRES ---- */}
				<div className="individuals-panel__filters">
					<div className="individuals-panel__filter-group">
						<div className="individuals-panel__filter-title">
							{t("individual.panel.groupFilterTitle")}
						</div>
						<div className="individuals-panel__chips">
							{[
								{ iri: "all", label: t("individual.panel.allGroups") },
								...userGroups,
							].map((g) => {
								const value = g.iri;
								const active = groupFilter === value;
								return (
									<button
										key={value}
										type="button"
										onClick={() => setGroupFilter(value)}
										className={`chip individuals-panel__chip${
											active ? " is-active" : ""
										}`}>
										{formatLabel(g.label || g.iri.split(/[#/]/).pop() || g.iri)}
									</button>
								);
							})}
						</div>
					</div>

					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("individual.panel.searchPlaceholder")}
						className="form-input"
					/>
				</div>
				<div className="individuals-panel__header">
					<h2 className="individuals-panel__title">
						{classLabel} —{" "}
						{t("individual.panel.count", { count: searchedIndividuals.length })}
					</h2>
					<button
						title={t("individual.panel.createTooltip")}
						onClick={() => onCreate(classId)}
						style={{ cursor: "pointer" }}
						className="button button--primary button--sm">
						+
					</button>
				</div>
				<div className="individuals-panel__list">
					{searchedIndividuals.map((ind, index) => (
						<IndividualCard
							key={ind.id}
							ind={ind}
							snapshot={snapshot}
							onShow={onShow}
							onEdit={onEdit}
							onDelete={onDelete}
							idx={index}
							defaultOpen={ind.id === focusedIndividualId}
							highlighted={ind.id === focusedIndividualId}
						/>
					))}
				</div>
			</div>
		</aside>
	);
};
export default IndividualsPanel;
