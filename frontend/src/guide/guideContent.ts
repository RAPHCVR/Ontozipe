import type { GuideContentEntry } from "./guideTypes";

const DEFAULT_VIDEO_ID = "UNLISTED_VIDEO_ID";

export const guideContent: GuideContentEntry[] = [
	{
		id: "profile.start",
		category: "profile",
		titleKey: "guide.content.profile.start.title",
		summaryKey: "guide.content.profile.start.summary",
		markdownKey: "guide.content.profile.start.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{ type: "warning", textKey: "guide.content.profile.start.callouts.warning" },
			{ type: "tip", textKey: "guide.content.profile.start.callouts.tip" },
			{ type: "note", textKey: "guide.content.profile.start.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.profile.start.steps.1" },
			{ textKey: "guide.content.profile.start.steps.2" },
			{ textKey: "guide.content.profile.start.steps.3" },
		],
	},
	{
		id: "profile.security",
		category: "profile",
		titleKey: "guide.content.profile.security.title",
		summaryKey: "guide.content.profile.security.summary",
		markdownKey: "guide.content.profile.security.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{ type: "warning", textKey: "guide.content.profile.security.callouts.warning" },
			{ type: "tip", textKey: "guide.content.profile.security.callouts.tip" },
			{ type: "note", textKey: "guide.content.profile.security.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.profile.security.steps.1" },
			{ textKey: "guide.content.profile.security.steps.2" },
			{ textKey: "guide.content.profile.security.steps.3" },
		],
	},
	{
		id: "organization.overview",
		category: "organization",
		titleKey: "guide.content.organization.overview.title",
		summaryKey: "guide.content.organization.overview.summary",
		markdownKey: "guide.content.organization.overview.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.organization.overview.callouts.warning",
			},
			{
				type: "tip",
				textKey: "guide.content.organization.overview.callouts.tip",
			},
			{
				type: "note",
				textKey: "guide.content.organization.overview.callouts.note",
			},
		],
		steps: [
			{ textKey: "guide.content.organization.overview.steps.1" },
			{ textKey: "guide.content.organization.overview.steps.2" },
			{ textKey: "guide.content.organization.overview.steps.3" },
		],
	},
	{
		id: "organization.members",
		category: "organization",
		titleKey: "guide.content.organization.members.title",
		summaryKey: "guide.content.organization.members.summary",
		markdownKey: "guide.content.organization.members.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		access: "admin",
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.organization.members.callouts.warning",
			},
			{
				type: "tip",
				textKey: "guide.content.organization.members.callouts.tip",
			},
			{
				type: "note",
				textKey: "guide.content.organization.members.callouts.note",
			},
		],
		steps: [
			{ textKey: "guide.content.organization.members.steps.1" },
			{ textKey: "guide.content.organization.members.steps.2" },
			{ textKey: "guide.content.organization.members.steps.3" },
		],
	},
	{
		id: "organization.settings",
		category: "organization",
		titleKey: "guide.content.organization.settings.title",
		summaryKey: "guide.content.organization.settings.summary",
		markdownKey: "guide.content.organization.settings.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		access: "admin",
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.organization.settings.callouts.warning",
			},
			{
				type: "tip",
				textKey: "guide.content.organization.settings.callouts.tip",
			},
			{
				type: "note",
				textKey: "guide.content.organization.settings.callouts.note",
			},
		],
		steps: [
			{ textKey: "guide.content.organization.settings.steps.1" },
			{ textKey: "guide.content.organization.settings.steps.2" },
			{ textKey: "guide.content.organization.settings.steps.3" },
		],
	},
	{
		id: "organization.users",
		category: "organization",
		titleKey: "guide.content.organization.users.title",
		summaryKey: "guide.content.organization.users.summary",
		markdownKey: "guide.content.organization.users.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		access: "superadmin",
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.organization.users.callouts.warning",
			},
			{ type: "tip", textKey: "guide.content.organization.users.callouts.tip" },
			{
				type: "note",
				textKey: "guide.content.organization.users.callouts.note",
			},
		],
		steps: [
			{ textKey: "guide.content.organization.users.steps.1" },
			{ textKey: "guide.content.organization.users.steps.2" },
			{ textKey: "guide.content.organization.users.steps.3" },
		],
	},
	{
		id: "organization.superadmin",
		category: "organization",
		titleKey: "guide.content.organization.superadmin.title",
		summaryKey: "guide.content.organization.superadmin.summary",
		markdownKey: "guide.content.organization.superadmin.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		access: "superadmin",
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.organization.superadmin.callouts.warning",
			},
			{
				type: "tip",
				textKey: "guide.content.organization.superadmin.callouts.tip",
			},
			{
				type: "note",
				textKey: "guide.content.organization.superadmin.callouts.note",
			},
		],
		steps: [
			{ textKey: "guide.content.organization.superadmin.steps.1" },
			{ textKey: "guide.content.organization.superadmin.steps.2" },
			{ textKey: "guide.content.organization.superadmin.steps.3" },
		],
	},
	{
		id: "group.create",
		category: "group",
		titleKey: "guide.content.group.create.title",
		summaryKey: "guide.content.group.create.summary",
		markdownKey: "guide.content.group.create.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{ type: "warning", textKey: "guide.content.group.create.callouts.warning" },
			{ type: "tip", textKey: "guide.content.group.create.callouts.tip" },
			{ type: "note", textKey: "guide.content.group.create.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.group.create.steps.1" },
			{ textKey: "guide.content.group.create.steps.2" },
			{ textKey: "guide.content.group.create.steps.3" },
		],
	},
	{
		id: "group.members",
		category: "group",
		titleKey: "guide.content.group.members.title",
		summaryKey: "guide.content.group.members.summary",
		markdownKey: "guide.content.group.members.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{ type: "warning", textKey: "guide.content.group.members.callouts.warning" },
			{ type: "tip", textKey: "guide.content.group.members.callouts.tip" },
			{ type: "note", textKey: "guide.content.group.members.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.group.members.steps.1" },
			{ textKey: "guide.content.group.members.steps.2" },
			{ textKey: "guide.content.group.members.steps.3" },
		],
	},
	{
		id: "ontology.explore",
		category: "ontology",
		titleKey: "guide.content.ontology.explore.title",
		summaryKey: "guide.content.ontology.explore.summary",
		markdownKey: "guide.content.ontology.explore.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.ontology.explore.callouts.warning",
			},
			{ type: "tip", textKey: "guide.content.ontology.explore.callouts.tip" },
			{
				type: "note",
				textKey: "guide.content.ontology.explore.callouts.note",
			},
		],
		steps: [
			{ textKey: "guide.content.ontology.explore.steps.1" },
			{ textKey: "guide.content.ontology.explore.steps.2" },
			{ textKey: "guide.content.ontology.explore.steps.3" },
		],
	},
	{
		id: "ontology.share",
		category: "ontology",
		titleKey: "guide.content.ontology.share.title",
		summaryKey: "guide.content.ontology.share.summary",
		markdownKey: "guide.content.ontology.share.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.ontology.share.callouts.warning",
			},
			{ type: "tip", textKey: "guide.content.ontology.share.callouts.tip" },
			{ type: "note", textKey: "guide.content.ontology.share.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.ontology.share.steps.1" },
			{ textKey: "guide.content.ontology.share.steps.2" },
			{ textKey: "guide.content.ontology.share.steps.3" },
		],
	},
	{
		id: "ontology.superadmin",
		category: "ontology",
		titleKey: "guide.content.ontology.superadmin.title",
		summaryKey: "guide.content.ontology.superadmin.summary",
		markdownKey: "guide.content.ontology.superadmin.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		access: "superadmin",
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.ontology.superadmin.callouts.warning",
			},
			{ type: "tip", textKey: "guide.content.ontology.superadmin.callouts.tip" },
			{ type: "note", textKey: "guide.content.ontology.superadmin.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.ontology.superadmin.steps.1" },
			{ textKey: "guide.content.ontology.superadmin.steps.2" },
			{ textKey: "guide.content.ontology.superadmin.steps.3" },
		],
	},
	{
		id: "chatbot.start",
		category: "chatbot",
		titleKey: "guide.content.chatbot.start.title",
		summaryKey: "guide.content.chatbot.start.summary",
		markdownKey: "guide.content.chatbot.start.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{ type: "warning", textKey: "guide.content.chatbot.start.callouts.warning" },
			{ type: "tip", textKey: "guide.content.chatbot.start.callouts.tip" },
			{ type: "note", textKey: "guide.content.chatbot.start.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.chatbot.start.steps.1", timestamp: "00:05" },
			{ textKey: "guide.content.chatbot.start.steps.2", timestamp: "00:25" },
			{ textKey: "guide.content.chatbot.start.steps.3", timestamp: "00:45" },
		],
	},
	{
		id: "chatbot.summaries",
		category: "chatbot",
		titleKey: "guide.content.chatbot.summaries.title",
		summaryKey: "guide.content.chatbot.summaries.summary",
		markdownKey: "guide.content.chatbot.summaries.markdown",
		youtubeVideoId: DEFAULT_VIDEO_ID,
		callouts: [
			{
				type: "warning",
				textKey: "guide.content.chatbot.summaries.callouts.warning",
			},
			{ type: "tip", textKey: "guide.content.chatbot.summaries.callouts.tip" },
			{ type: "note", textKey: "guide.content.chatbot.summaries.callouts.note" },
		],
		steps: [
			{ textKey: "guide.content.chatbot.summaries.steps.1" },
			{ textKey: "guide.content.chatbot.summaries.steps.2" },
			{ textKey: "guide.content.chatbot.summaries.steps.3" },
		],
	},
];

export const guideContentById = new Map(
	guideContent.map((entry) => [entry.id, entry])
);
