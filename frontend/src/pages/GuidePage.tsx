import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { guideNav } from "../guide/guideNav";
import { guideContent } from "../guide/guideContent";
import type { GuideAccess } from "../guide/guideTypes";
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

export default function GuidePage() {
	const { t } = useTranslation();
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const profileQuery = useProfile();
	const roles = profileQuery.data?.roles ?? [];
	const heroRef = useRef<HTMLDivElement | null>(null);
	const pageRef = useRef<HTMLDivElement | null>(null);

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
	const activeIndex = activeId ? orderedIds.indexOf(activeId) : -1;
	const previousEntry =
		activeIndex > 0 ? contentMap.get(orderedIds[activeIndex - 1]) : undefined;
	const nextEntry =
		activeIndex >= 0 && activeIndex < orderedIds.length - 1
			? contentMap.get(orderedIds[activeIndex + 1])
			: undefined;

	useEffect(() => {
		if (!activeId) return;
		if (id !== activeId) {
			navigate(`/guide/${activeId}`, { replace: true });
		}
	}, [activeId, id, navigate]);

	useLayoutEffect(() => {
		const heroEl = heroRef.current;
		const pageEl = pageRef.current;
		if (!heroEl || !pageEl) return;

		const navEl = document.querySelector<HTMLElement>(".navbar");
		const rootFontSize =
			parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
		const gap = rootFontSize * 1.5;
		let rafId = 0;

		const updateSidebarTop = () => {
			const heroRect = heroEl.getBoundingClientRect();
			const navHeight = navEl?.getBoundingClientRect().height ?? 0;
			const minTop = navHeight + gap;
			const desiredTop = heroRect.bottom + gap;
			const top = Math.max(desiredTop, minTop);
			pageEl.style.setProperty("--guide-sidebar-top", `${top}px`);
		};

		const scheduleUpdate = () => {
			if (rafId) return;
			rafId = window.requestAnimationFrame(() => {
				rafId = 0;
				updateSidebarTop();
			});
		};

		updateSidebarTop();

		const resizeObserver =
			typeof ResizeObserver !== "undefined"
				? new ResizeObserver(updateSidebarTop)
				: null;

		resizeObserver?.observe(heroEl);
		if (navEl) resizeObserver?.observe(navEl);

		window.addEventListener("scroll", scheduleUpdate, { passive: true });
		window.addEventListener("resize", scheduleUpdate);

		return () => {
			if (rafId) {
				window.cancelAnimationFrame(rafId);
			}
			window.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("resize", scheduleUpdate);
			resizeObserver?.disconnect();
		};
	}, []);

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

	return (
		<div className="guide-page" ref={pageRef}>
			<div className="guide-hero" ref={heroRef}>
				<div className="app-container guide-hero__inner">
					<div className="guide-hero__text">
						<h1>{t("guide.page.title")}</h1>
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
				<GuideContent
					entry={activeEntry}
					previous={previousEntry}
					next={nextEntry}
					onNavigate={(value) => navigate(`/guide/${value}`)}
				/>
			</div>
		</div>
	);
}
