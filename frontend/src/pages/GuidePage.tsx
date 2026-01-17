import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { guideNav } from "../guide/guideNav";
import { guideContent } from "../guide/guideContent";
import type { GuideAccess, GuideContentEntry, GuideNavCategory } from "../guide/guideTypes";
import GuideSidebar from "../components/guide/GuideSidebar";
import GuideContent from "../components/guide/GuideContent";
import { useTranslation } from "../language/useTranslation";
import { useProfile } from "../hooks/apiQueries";

const normalize = (value: string) =>
	value
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");

const canAccess = (access: GuideAccess | undefined, roles: string[]) => {
	const isSuperAdmin = roles.some((role) => role.endsWith("SuperAdminRole"));
	const isAdmin =
		isSuperAdmin || roles.some((role) => role.endsWith("AdminRole"));
	if (!access || access === "all") return true;
	if (access === "superadmin") return isSuperAdmin;
	if (access === "admin") return isAdmin;
	return false;
};

const findCategoryLabel = (
	categories: GuideNavCategory[],
	entry?: GuideContentEntry
) => {
	if (!entry) return undefined;
	for (const category of categories) {
		for (const section of category.sections) {
			if (section.items.some((item) => item.id === entry.id)) {
				return category.titleKey;
			}
		}
	}
	return undefined;
};

export default function GuidePage() {
	const { t } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const profileQuery = useProfile();
	const roles = profileQuery.data?.roles ?? [];

	const accessibleContent = useMemo(
		() => guideContent.filter((entry) => canAccess(entry.access, roles)),
		[roles]
	);

	const contentMap = useMemo(
		() =>
			new Map(
				accessibleContent.map((entry) => [entry.id, entry] as const)
			),
		[accessibleContent]
	);

	const orderedIds = useMemo(() => {
		const list: string[] = [];
		guideNav.forEach((category) => {
			category.sections.forEach((section) => {
				section.items.forEach((item) => {
					if (!canAccess(item.access, roles)) return;
					if (!contentMap.has(item.id)) return;
					list.push(item.id);
				});
			});
		});
		return list;
	}, [contentMap, roles]);

	const defaultId = orderedIds[0];
	const activeId = id && contentMap.has(id) ? id : defaultId;
	const activeEntry = activeId ? contentMap.get(activeId) : undefined;

	useEffect(() => {
		if (!activeId) return;
		if (id !== activeId) {
			navigate(`/guide/${activeId}`, { replace: true });
		}
	}, [activeId, id, navigate]);

	const [searchTerm, setSearchTerm] = useState("");
	const normalizedSearch = normalize(searchTerm.trim());

	const filteredNav = useMemo(() => {
		if (!normalizedSearch) {
			return guideNav
				.map((category) => ({
					...category,
					sections: category.sections
						.map((section) => ({
							...section,
							items: section.items.filter(
								(item) =>
									contentMap.has(item.id) &&
									canAccess(item.access, roles)
							),
						}))
						.filter((section) => section.items.length > 0),
				}))
				.filter((category) => category.sections.length > 0);
		}

		return guideNav
			.map((category) => ({
				...category,
				sections: category.sections
					.map((section) => ({
						...section,
						items: section.items.filter((item) => {
							if (!contentMap.has(item.id)) return false;
							if (!canAccess(item.access, roles)) return false;
							const entry = contentMap.get(item.id);
							if (!entry) return false;
							const haystack = normalize(
								`${t(item.titleKey)} ${t(entry.summaryKey)} ${t(
									entry.markdownKey
								)}`
							);
							return haystack.includes(normalizedSearch);
						}),
					}))
					.filter((section) => section.items.length > 0),
			}))
			.filter((category) => category.sections.length > 0);
	}, [contentMap, normalizedSearch, roles, t]);

	const [sidebarOpen, setSidebarOpen] = useState(false);
	const categoryTitleKey = findCategoryLabel(guideNav, activeEntry);
	const categoryLabel = categoryTitleKey ? t(categoryTitleKey) : undefined;

	return (
		<div className="guide-page">
			<div className="guide-hero">
				<div className="app-container guide-hero__inner">
					<div className="guide-hero__text">
						<span className="guide-hero__badge">{t("guide.page.badge")}</span>
						<h1>{t("guide.page.title")}</h1>
						<p>{t("guide.page.subtitle")}</p>
					</div>
					<button
						type="button"
						className="guide-hero__toggle"
						onClick={() => setSidebarOpen(true)}>
						{t("guide.sidebar.open")}
					</button>
				</div>
			</div>

			<div className="app-container guide-layout">
				<div
					className={`guide-overlay ${sidebarOpen ? "is-visible" : ""}`}
					onClick={() => setSidebarOpen(false)}
					aria-hidden="true"
				/>
				<GuideSidebar
					categories={filteredNav}
					activeId={activeId}
					searchTerm={searchTerm}
					onSearchChange={setSearchTerm}
					onSelect={(value) => navigate(`/guide/${value}`)}
					isOpen={sidebarOpen}
					onClose={() => setSidebarOpen(false)}
				/>
				<GuideContent entry={activeEntry} categoryLabel={categoryLabel} />
			</div>
		</div>
	);
}
