import type { TranslationKey } from "../language/messages";

export type GuideAccess = "all" | "admin" | "superadmin";

export type GuideNavItem = {
	id: string;
	titleKey: TranslationKey;
	access?: GuideAccess;
};

export type GuideNavSection = {
	id: string;
	titleKey: TranslationKey;
	items: GuideNavItem[];
};

export type GuideNavCategory = {
	id: string;
	titleKey: TranslationKey;
	sections: GuideNavSection[];
};

export type GuideCalloutType = "warning" | "tip" | "note";

export type GuideCallout = {
	type: GuideCalloutType;
	textKey: TranslationKey;
};

export type GuideStep = {
	textKey: TranslationKey;
	timestamp?: string;
};

export type GuideContentEntry = {
	id: string;
	category: string;
	titleKey: TranslationKey;
	summaryKey: TranslationKey;
	markdownKey: TranslationKey;
	youtubeVideoId?: string;
	youtubeUrl?: string;
	callouts?: GuideCallout[];
	steps?: GuideStep[];
	access?: GuideAccess;
};
