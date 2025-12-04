import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { useDashboard, ScopeType } from "../hooks/useDashboard";
import {
	useGroups,
	useOntologies,
	useOrganizations,
	useProfile,
} from "../hooks/apiQueries";
import { useTranslation } from "../language/useTranslation";
import { useLanguage } from "../language/LanguageContext";
import { formatLabel } from "../utils/formatLabel";
import { useDashboardSummary } from "../hooks/useDashboardSummary";
import SimpleModal from "../components/SimpleModal";
import type { TranslationKey } from "../language/messages";

type TabKey = "platform" | "governance" | "me" | "comments";

type ListItem = {
	label: string;
	value?: string | number;
	subtitle?: string;
	href?: string;
};

const PERIOD_PRESETS: Array<{ key: string; days?: number; labelKey: TranslationKey }> =
	[
		{ key: "7d", days: 7, labelKey: "dashboard.period.7d" },
		{ key: "30d", days: 30, labelKey: "dashboard.period.30d" },
		{ key: "90d", days: 90, labelKey: "dashboard.period.90d" },
		{ key: "all", days: undefined, labelKey: "dashboard.period.all" },
		{ key: "custom", days: undefined, labelKey: "dashboard.period.custom" },
	];

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
	{ key: "platform", labelKey: "dashboard.tabs.platform" },
	{ key: "governance", labelKey: "dashboard.tabs.governance" },
	{ key: "me", labelKey: "dashboard.tabs.me" },
	{ key: "comments", labelKey: "dashboard.tabs.comments" },
];

const formatSlug = (iri: string) => {
	try {
		const decoded = decodeURIComponent(iri);
		const parts = decoded.split(/[#/]/).filter(Boolean);
		return formatLabel(parts[parts.length - 1] || decoded);
	} catch {
		return iri;
	}
};

const formatUser = (iri: string) => {
	const slug = formatSlug(iri);
	return slug.replace("mailto:", "");
};

const truncate = (value: string, max = 80) =>
	value.length > max ? `${value.slice(0, max)}…` : value;

const formatDate = (value?: string) => {
	if (!value) return "";
	return dayjs(value).format("DD MMM YYYY HH:mm");
};

const formatClass = (label?: string, iri?: string) =>
	label || formatSlug(iri || "");

const buildFocusLink = (ontologyIri?: string, resourceIri?: string) => {
	if (!ontologyIri) return undefined;
	const search = new URLSearchParams({ iri: ontologyIri });
	if (resourceIri) search.set("focus", resourceIri);
	return `/ontology?${search.toString()}`;
};

export default function DashboardPage() {
	const { t } = useTranslation();
	const { language } = useLanguage();
	const profileQuery = useProfile();
	const roles = profileQuery.data?.roles ?? [];
	const isSuperAdmin = roles.some((role) => role.endsWith("SuperAdminRole"));

	useEffect(() => {
		dayjs.locale(language);
	}, [language]);

	const [tab, setTab] = useState<TabKey>("platform");
	const [periodKey, setPeriodKey] = useState<string>("30d");
	const [customStart, setCustomStart] = useState("");
	const [customEnd, setCustomEnd] = useState("");
	const [scopeType, setScopeType] = useState<ScopeType>("all");
	const [scopeId, setScopeId] = useState<string | undefined>();
	const [summaryOpen, setSummaryOpen] = useState(false);

	const groupsQuery = useGroups();
	const ontologiesQuery = useOntologies();
	const orgsQuery = useOrganizations(isSuperAdmin ? "all" : "mine");

	useEffect(() => {
		if (scopeType === "all") {
			setScopeId(undefined);
			return;
		}
		const options =
			scopeType === "ontology"
				? ontologiesQuery.data ?? []
				: scopeType === "organization"
				? orgsQuery.data ?? []
				: groupsQuery.data ?? [];
		if (!scopeId && options.length > 0) {
			setScopeId(options[0].iri);
		}
	}, [
		scopeType,
		scopeId,
		ontologiesQuery.data,
		orgsQuery.data,
		groupsQuery.data,
	]);

	const { start, end } = useMemo(() => {
		if (periodKey === "custom") {
			return {
				start: customStart
					? dayjs(customStart).startOf("day").toISOString()
					: undefined,
				end: customEnd
					? dayjs(customEnd).endOf("day").toISOString()
					: undefined,
			};
		}
		if (periodKey === "all") return { start: undefined, end: undefined };
		const preset = PERIOD_PRESETS.find((p) => p.key === periodKey);
		if (!preset?.days) return { start: undefined, end: undefined };
		const now = dayjs();
		return {
			start: now.subtract(preset.days, "day").startOf("day").toISOString(),
			end: now.toISOString(),
		};
	}, [periodKey, customStart, customEnd]);

	const dashboardQuery = useDashboard({
		start,
		end,
		scopeType,
		scopeId,
	});

	const summaryInput = useMemo(() => {
		if (!dashboardQuery.data) return null;
		const sectionKey =
			tab === "platform"
				? "platform"
				: tab === "governance"
				? "governance"
				: tab === "me"
				? "me"
				: "comments";
		const payload =
			tab === "platform"
				? dashboardQuery.data.platform?.data
				: tab === "governance"
				? dashboardQuery.data.governance?.data
				: tab === "me"
				? dashboardQuery.data.myActivity?.data
				: dashboardQuery.data.comments?.data;
		return { section: sectionKey, payload };
	}, [dashboardQuery.data, tab]);

	const summaryQuery = useDashboardSummary(summaryInput);

	const renderKpiCard = (label: string, value: number | string | undefined) => (
		<div className="dash-card dash-card--compact">
			<p className="dash-card__label">{label}</p>
			<p className="dash-card__value">{value ?? "-"}</p>
		</div>
	);

	const renderList = (title: string, items: ListItem[]) => (
		<div className="dash-panel dash-panel--wide">
			<div className="dash-panel__header">
				<h3>{title}</h3>
			</div>
			<div className="dash-panel__body">
				{items.length === 0 && (
					<p className="dash-empty">{t("dashboard.empty")}</p>
				)}
				<ul className="dash-list">
					{items.map((item) => {
						const content = (
							<>
								<span className="dash-list__label">{item.label}</span>
								<div className="dash-list__meta">
									{item.subtitle && (
										<span className="dash-list__subtitle">{item.subtitle}</span>
									)}
									{item.value !== undefined && (
										<span className="dash-list__value">{item.value}</span>
									)}
								</div>
							</>
						);
						return (
							<li
								key={`${item.label}-${item.value ?? ""}`}
								className="dash-list__item">
								{item.href ? (
									<Link to={item.href} className="dash-list__link">
										{content}
									</Link>
								) : (
									content
								)}
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);

	const platformData = dashboardQuery.data?.platform?.data;
	const governanceData = dashboardQuery.data?.governance?.data;
	const myData = dashboardQuery.data?.myActivity?.data;
	const commentsData = dashboardQuery.data?.comments?.data;

	return (
		<div className="dashboard-page">
			<header className="dashboard-topbar">
				<div className="dashboard-tabs" role="tablist" aria-label="Dashboards">
					{TABS.map((tTab) => (
						<button
							key={tTab.key}
							type="button"
							className={`dashboard-tab ${tab === tTab.key ? "is-active" : ""}`}
							onClick={() => setTab(tTab.key)}
							role="tab"
							aria-selected={tab === tTab.key}>
							{t(tTab.labelKey)}
						</button>
					))}
				</div>

				<div className="dashboard-filters">
					<div className="dashboard-filter">
						<label className="dashboard-filter__label">
							{t("dashboard.filters.period")}
						</label>
						<div className="dashboard-period">
							{PERIOD_PRESETS.map((preset) => (
								<button
									key={preset.key}
									type="button"
									className={`chip ${
										periodKey === preset.key ? "is-active" : ""
									}`}
									onClick={() => setPeriodKey(preset.key)}>
									{t(preset.labelKey)}
								</button>
							))}
						</div>
						{periodKey === "custom" && (
							<div className="dashboard-custom-range">
								<input
									type="date"
									value={customStart}
									onChange={(e) => setCustomStart(e.target.value)}
									className="form-input"
								/>
								<span className="dashboard-range-sep">→</span>
								<input
									type="date"
									value={customEnd}
									onChange={(e) => setCustomEnd(e.target.value)}
									className="form-input"
								/>
							</div>
						)}
					</div>

					<div className="dashboard-filter">
						<label className="dashboard-filter__label">
							{t("dashboard.filters.scope")}
						</label>
						<div className="dashboard-scope">
							<select
								value={scopeType}
								onChange={(e) => setScopeType(e.target.value as ScopeType)}
								className="form-input">
								<option value="all">{t("dashboard.scope.all")}</option>
								<option value="ontology">
									{t("dashboard.scope.ontology")}
								</option>
								<option value="organization">
									{t("dashboard.scope.organization")}
								</option>
								<option value="group">{t("dashboard.scope.group")}</option>
							</select>
					{scopeType !== "all" && (
						<select
							value={scopeId ?? ""}
							onChange={(e) => setScopeId(e.target.value || undefined)}
							className="form-input">
									<option value="">{t("dashboard.empty")}</option>
									{scopeType === "ontology" &&
										(ontologiesQuery.data ?? []).map((o) => (
											<option key={o.iri} value={o.iri}>
												{o.label ?? formatSlug(o.iri)}
											</option>
										))}
									{scopeType === "organization" &&
										(orgsQuery.data ?? []).map((o) => (
											<option key={o.iri} value={o.iri}>
												{o.label ?? formatSlug(o.iri)}
											</option>
										))}
									{scopeType === "group" &&
										(groupsQuery.data ?? []).map((g: any) => (
											<option key={g.iri} value={g.iri}>
												{g.label ?? formatSlug(g.iri)}
											</option>
										))}
								</select>
							)}
						</div>
					</div>

					<button
						type="button"
						className="dashboard-summary__button"
						onClick={() => setSummaryOpen(true)}>
						<i className="fas fa-wand-magic-sparkles" aria-hidden />
						{t("dashboard.section.summary")}
					</button>
				</div>
			</header>

			<div className="dashboard-content">
				{dashboardQuery.isLoading && (
					<div className="dashboard-state">
						<div className="page-state__spinner" aria-hidden />
						<p>{t("dashboard.state.loading")}</p>
					</div>
				)}
				{dashboardQuery.isError && (
					<div className="dashboard-state">
						<i className="fas fa-exclamation-triangle" aria-hidden />
						<p>{t("dashboard.state.error")}</p>
					</div>
				)}

				{!dashboardQuery.isLoading && dashboardQuery.data && (
					<>
						{summaryOpen && (
							<SimpleModal
								title={t("dashboard.section.summary")}
								onClose={() => setSummaryOpen(false)}
								onSubmit={() => setSummaryOpen(false)}>
								{summaryQuery.isLoading && (
									<p className="dash-muted">{t("dashboard.state.loading")}</p>
								)}
								{summaryQuery.isError && (
									<p className="dash-muted">{t("dashboard.state.error")}</p>
								)}
								{summaryQuery.data && <p>{summaryQuery.data}</p>}
							</SimpleModal>
						)}

						{tab === "platform" && (
							<section className="dashboard-grid" role="tabpanel">
								{renderKpiCard(
									t("dashboard.kpi.ontologies"),
									platformData?.kpis?.ontologies
								)}
								{renderKpiCard(
									t("dashboard.kpi.organizations"),
									platformData?.kpis?.organizations
								)}
								{renderKpiCard(
									t("dashboard.kpi.groups"),
									platformData?.kpis?.groups
								)}
								{renderKpiCard(
									t("dashboard.kpi.activeAccounts"),
									platformData?.kpis?.activeAccounts
								)}

								<div className="dash-panel">
									<div className="dash-panel__header">
										<h3>{t("dashboard.section.activity")}</h3>
									</div>
									<div className="dash-panel__body dash-pairs">
										<div>
											<p className="dash-muted">
												{t("dashboard.metric.individualsCreated")}
											</p>
											<p className="dash-strong">
												{platformData?.activity?.individualsCreated ?? "-"}
											</p>
										</div>
										<div>
											<p className="dash-muted">
												{t("dashboard.metric.commentsCreated")}
											</p>
											<p className="dash-strong">
												{platformData?.activity?.commentsCreated ?? "-"}
											</p>
										</div>
										<div>
											<p className="dash-muted">
												{t("dashboard.metric.updates")}
											</p>
											<p className="dash-strong">
												{platformData?.activity?.updates ?? "-"}
											</p>
										</div>
									</div>
								</div>

								{renderList(
									t("dashboard.section.topContributors"),
									(platformData?.topContributors ?? []).map((c: any) => ({
										label: formatUser(c.user),
										value: c.score,
									}))
								)}
								<div className="dash-panel">
									<div className="dash-panel__header">
										<h3>{t("dashboard.section.health")}</h3>
									</div>
									<div className="dash-panel__body dash-pairs">
										<div>
											<p className="dash-muted">
												{t("dashboard.metric.growthIndividuals")}
											</p>
											<p className="dash-strong">
												{platformData?.projectHealth?.individualGrowth ?? "-"}
											</p>
										</div>
										<div>
											<p className="dash-muted">
												{t("dashboard.metric.growthComments")}
											</p>
											<p className="dash-strong">
												{platformData?.projectHealth?.commentGrowth ?? "-"}
											</p>
										</div>
									</div>
								</div>
							</section>
						)}

						{tab === "governance" && (
							<section className="dashboard-grid" role="tabpanel">
								{renderKpiCard(
									t("dashboard.kpi.groups"),
									governanceData?.kpis?.groups
								)}
								{renderKpiCard(
									t("dashboard.kpi.organizations"),
									governanceData?.kpis?.organizations
								)}
								{renderKpiCard(
									t("dashboard.kpi.activeMembers"),
									governanceData?.kpis?.activeMembers
								)}
								{renderKpiCard(
									t("dashboard.kpi.recentComments"),
									governanceData?.kpis?.recentComments
								)}

								{renderList(
									t("dashboard.section.topUsers"),
									(governanceData?.topUsers ?? []).map((u: any) => ({
										label: formatUser(u.user),
										value: u.score,
									}))
								)}

								{renderList(
									t("dashboard.section.topThreads"),
									(governanceData?.topThreads ?? []).map((thread: any) => ({
										label: truncate(thread.body || formatSlug(thread.comment)),
										value: thread.replies,
										subtitle: formatClass(thread.classLabel, thread.classIri),
										href: buildFocusLink(thread.ontologyIri, thread.onResource),
									}))
								)}

								{renderList(
									t("dashboard.section.topIndividuals"),
									(governanceData?.topIndividuals ?? []).map((i: any) => ({
										label: i.label || formatSlug(i.iri),
										value: i.score,
										subtitle: formatClass(i.classLabel, i.classIri),
										href: buildFocusLink(i.ontologyIri, i.iri),
									}))
								)}

								{renderList(
									t("dashboard.section.topClasses"),
									(governanceData?.topClasses ?? []).map((c: any) => ({
										label: c.label || formatSlug(c.iri),
										value: c.score,
										href: buildFocusLink(c.ontologyIri, c.iri),
									}))
								)}
							</section>
						)}

						{tab === "me" && (
							<section className="dashboard-grid" role="tabpanel">
								{renderKpiCard(
									t("dashboard.kpi.createdEdited"),
									myData?.kpis?.createdOrEdited
								)}
								{renderKpiCard(
									t("dashboard.kpi.commentsPosted"),
									myData?.kpis?.comments
								)}

								{renderList(
									t("dashboard.section.lastIndividuals"),
									(myData?.lastIndividuals ?? []).map((item: any) => ({
										label: item.label || formatSlug(item.iri),
										subtitle: `${formatClass(
											item.classLabel,
											item.classIri
										)} · ${formatDate(item.updatedAt || item.createdAt)}`,
										href: buildFocusLink(item.ontologyIri, item.iri),
									}))
								)}

								{renderList(
									t("dashboard.section.lastComments"),
									(myData?.lastComments ?? []).map((item: any) => ({
										label: truncate(item.body || formatSlug(item.iri)),
										subtitle: `${formatClass(
											item.classLabel,
											item.classIri
										)} · ${formatDate(item.updatedAt || item.createdAt)}`,
										href: buildFocusLink(item.ontologyIri, item.onResource),
									}))
								)}
							</section>
						)}

						{tab === "comments" && (
							<section className="dashboard-grid" role="tabpanel">
								{renderList(
									t("dashboard.section.topThreads"),
									(commentsData?.topThreads ?? []).map((tThread: any) => ({
										label: truncate(
											tThread.body || formatSlug(tThread.comment)
										),
										value: tThread.replies,
										subtitle: formatClass(tThread.classLabel, tThread.classIri),
										href: buildFocusLink(
											tThread.ontologyIri,
											tThread.onResource
										),
									}))
								)}

								{renderList(
									t("dashboard.section.recentThreads"),
									(commentsData?.recentThreads ?? []).map((tThread: any) => ({
										label: truncate(
											tThread.body || formatSlug(tThread.comment)
										),
										subtitle: `${formatClass(
											tThread.classLabel,
											tThread.classIri
										)} · ${formatDate(tThread.createdAt)}`,
										href: buildFocusLink(
											tThread.ontologyIri,
											tThread.onResource
										),
									}))
								)}

								{renderList(
									t("dashboard.section.threadsWithoutReply"),
									(commentsData?.threadsWithoutReply ?? []).map(
										(tThread: any) => ({
											label: truncate(
												tThread.body || formatSlug(tThread.comment)
											),
											subtitle: `${formatClass(
												tThread.classLabel,
												tThread.classIri
											)} · ${formatDate(tThread.createdAt)}`,
											href: buildFocusLink(
												tThread.ontologyIri,
												tThread.onResource
											),
										})
									)
								)}
							</section>
						)}
					</>
				)}
			</div>
		</div>
	);
}
