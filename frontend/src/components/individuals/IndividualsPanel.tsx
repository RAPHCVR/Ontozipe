import React, { useState, useMemo } from "react";
import { IndividualNode, CommentNode, Snapshot } from "../../types";
import { formatLabel } from "../../utils/formatLabel";
import IndividualCard from "./IndividualCard";
import { useAuth } from "../../auth/AuthContext";

// ---------------------------------------------------------------------------
// Individuals side‑panel
// ---------------------------------------------------------------------------
const IndividualsPanel: React.FC<{
	snapshot: Snapshot;
	classId: string | null;
	onShow: (ind: IndividualNode) => void;
	onCreate: (classId: string) => void;
	onEdit: (ind: IndividualNode) => void;
	onDelete: (ind: IndividualNode) => void;
	onAddComment: (ind: IndividualNode) => void;
	width: number;
}> = ({
	snapshot,
	classId,
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
			<aside className="shrink-0 pr-2" style={{ width }}>
				<div className="card h-full flex items-center justify-center text-gray-500">
					Sélectionnez une classe
				</div>
			</aside>
		);
	}

	const classLabel = classId
		? formatLabel(classId.split(/[#/]/).pop() || classId)
		: "";

	return (
		<aside className="max-h-full pr-2 flex flex-col shrink-0" style={{ width }}>
			<div className="card flex-1 min-h-0 flex flex-col divide-y divide-gray-200 dark:divide-slate-700 overflow-y-auto">
				{/* ---- FILTRES ---- */}
				<div className="sticky top-0 bg-inherit pt-2 pb-3 space-y-2">
					<select
						value={groupFilter}
						onChange={(e) => setGroupFilter(e.target.value)}
						className="border w-full rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600">
						<option value="all">Tous les groupes</option>
						{userGroups.map((g) => (
							<option key={g.iri} value={g.iri}>
								{formatLabel(g.label || g.iri.split(/[#/]/).pop() || g.iri)}
							</option>
						))}
					</select>

					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Rechercher..."
						className="flex-1 w-full border rounded px-2 py-1 text-sm dark:bg-slate-800 dark:border-slate-600"
					/>
				</div>
				<div className="flex items-center justify-between sticky top-0 bg-inherit py-2">
					<h2 className="text-lg font-semibold">
						{classLabel} ({searchedIndividuals.length})
					</h2>
					<button
						title="Nouvel individu"
						onClick={() => onCreate(classId)}
						className="text-indigo-600 hover:text-indigo-800 text-xl leading-none px-2">
						+
					</button>
				</div>
				{searchedIndividuals.map((ind, index) => (
					<IndividualCard
						key={ind.id}
						ind={ind}
						snapshot={snapshot}
						onShow={onShow}
						onEdit={onEdit}
						onDelete={onDelete}
						idx={index}
					/>
				))}
			</div>
		</aside>
	);
};
export default IndividualsPanel;
