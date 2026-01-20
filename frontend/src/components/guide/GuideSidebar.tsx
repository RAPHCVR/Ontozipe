import { useEffect, useMemo, useState } from "react";
import type { GuideNavCategory, GuideAccess } from "../../guide/guideTypes";
import { useTranslation } from "../../language/useTranslation";
import type { TranslationKey } from "../../language/messages";

type GuideSidebarProps = {
	categories: GuideNavCategory[];
	activeId?: string;
	searchTerm: string;
	onSearchChange: (value: string) => void;
	onSelect: (id: string) => void;
	isOpen: boolean;
	onClose: () => void;
};

const accessLabelKey: Record<Exclude<GuideAccess, "all">, TranslationKey> = {
	admin: "guide.access.admin",
	superadmin: "guide.access.superadmin",
};

export default function GuideSidebar({
	categories,
	activeId,
	searchTerm,
	onSearchChange,
	onSelect,
	isOpen,
	onClose,
}: GuideSidebarProps) {
	const { t } = useTranslation();
	const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
		{}
	);
	const [openSections, setOpenSections] = useState<Record<string, boolean>>(
		{}
	);

	useEffect(() => {
		if (!activeId) return;
		categories.forEach((category) => {
			category.sections.forEach((section) => {
				if (section.items.some((item) => item.id === activeId)) {
					setOpenCategories((prev) => ({ ...prev, [category.id]: true }));
					setOpenSections((prev) => ({ ...prev, [section.id]: true }));
				}
			});
		});
	}, [activeId, categories]);

	const hasResults = useMemo(
		() =>
			categories.some((category) =>
				category.sections.some((section) => section.items.length > 0)
			),
		[categories]
	);

	return (
		<aside className={`guide-sidebar ${isOpen ? "is-open" : ""}`}>
			<div className="guide-sidebar__header">
				<div>
					<span className="guide-sidebar__title">{t("guide.sidebar.title")}</span>
					<p className="guide-sidebar__subtitle">
						{t("guide.sidebar.subtitle")}
					</p>
				</div>
				<button
					type="button"
					className="guide-sidebar__close"
					onClick={onClose}
					aria-label={t("guide.sidebar.close")}>
					x
				</button>
			</div>

			<div className="guide-sidebar__search">
				<input
					value={searchTerm}
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder={t("guide.search.placeholder")}
					aria-label={t("guide.search.aria")}
				/>
				{searchTerm && (
					<button
						type="button"
						className="guide-sidebar__clear"
						onClick={() => onSearchChange("")}>
						{t("guide.search.clear")}
					</button>
				)}
			</div>

			<div className="guide-sidebar__content">
				{!hasResults && (
					<div className="guide-sidebar__empty">
						<strong>{t("guide.search.emptyTitle")}</strong>
						<p>{t("guide.search.emptyHint")}</p>
					</div>
				)}

				{hasResults &&
					categories.map((category) => (
						<div className="guide-accordion" key={category.id}>
							<button
								type="button"
								className="guide-accordion__toggle"
								aria-expanded={Boolean(openCategories[category.id])}
								onClick={() =>
									setOpenCategories((prev) => ({
										...prev,
										[category.id]: !prev[category.id],
									}))
								}>
								<span>{t(category.titleKey)}</span>
								<span className="guide-accordion__icon">
									{openCategories[category.id] ? "-" : "+"}
								</span>
							</button>

							<div
								className={`guide-accordion__panel ${
									openCategories[category.id] ? "is-open" : ""
								}`}>
								{category.sections.map((section) => (
									<div className="guide-accordion__section" key={section.id}>
										<button
											type="button"
											className="guide-accordion__section-toggle"
											aria-expanded={Boolean(openSections[section.id])}
											onClick={() =>
												setOpenSections((prev) => ({
													...prev,
													[section.id]: !prev[section.id],
												}))
											}>
											<span>{t(section.titleKey)}</span>
											<span className="guide-accordion__icon">
												{openSections[section.id] ? "-" : "+"}
											</span>
										</button>

										<div
											className={`guide-accordion__items ${
												openSections[section.id] ? "is-open" : ""
											}`}>
											{section.items.map((item) => (
												<button
													key={item.id}
													type="button"
													className={`guide-accordion__item ${
														item.id === activeId ? "is-active" : ""
													}`}
													onClick={() => {
														onSelect(item.id);
														onClose();
													}}>
													<span>{t(item.titleKey)}</span>
													{item.access && item.access !== "all" && (
														<span className="guide-accordion__badge">
															{t(accessLabelKey[item.access])}
														</span>
													)}
												</button>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
			</div>
		</aside>
	);
}
