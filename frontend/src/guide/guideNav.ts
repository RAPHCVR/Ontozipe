import type { GuideNavCategory } from "./guideTypes";

export const guideNav: GuideNavCategory[] = [
	{
		id: "profile",
		titleKey: "guide.nav.category.profile",
		sections: [
			{
				id: "profile-basics",
				titleKey: "guide.nav.section.profile.basics",
				items: [
					{ id: "profile.start", titleKey: "guide.nav.item.profile.start" },
					{
						id: "profile.security",
						titleKey: "guide.nav.item.profile.security",
					},
				],
			},
		],
	},
	{
		id: "organization",
		titleKey: "guide.nav.category.organization",
		sections: [
			{
				id: "organization-basics",
				titleKey: "guide.nav.section.organization.basics",
				items: [
					{
						id: "organization.overview",
						titleKey: "guide.nav.item.organization.overview",
					},
				],
			},
			{
				id: "organization-people",
				titleKey: "guide.nav.section.organization.people",
				items: [
					{
						id: "organization.members",
						titleKey: "guide.nav.item.organization.members",
						access: "admin",
					},
				],
			},
			{
				id: "organization-admin",
				titleKey: "guide.nav.section.organization.admin",
				items: [
					{
						id: "organization.settings",
						titleKey: "guide.nav.item.organization.settings",
						access: "admin",
					},
					{
						id: "organization.users",
						titleKey: "guide.nav.item.organization.users",
						access: "superadmin",
					},
					{
						id: "organization.superadmin",
						titleKey: "guide.nav.item.organization.superadmin",
						access: "superadmin",
					},
				],
			},
		],
	},
	{
		id: "group",
		titleKey: "guide.nav.category.group",
		sections: [
			{
				id: "group-basics",
				titleKey: "guide.nav.section.group.basics",
				items: [
					{ id: "group.create", titleKey: "guide.nav.item.group.create" },
				],
			},
			{
				id: "group-people",
				titleKey: "guide.nav.section.group.people",
				items: [
					{
						id: "group.members",
						titleKey: "guide.nav.item.group.members",
					},
				],
			},
		],
	},
	{
		id: "ontology",
		titleKey: "guide.nav.category.ontology",
		sections: [
			{
				id: "ontology-explore",
				titleKey: "guide.nav.section.ontology.explore",
				items: [
					{
						id: "ontology.explore",
						titleKey: "guide.nav.item.ontology.explore",
					},
					{
						id: "ontology.share",
						titleKey: "guide.nav.item.ontology.share",
					},
				],
			},
			{
				id: "ontology-admin",
				titleKey: "guide.nav.section.ontology.admin",
				items: [
					{
						id: "ontology.superadmin",
						titleKey: "guide.nav.item.ontology.superadmin",
						access: "superadmin",
					},
				],
			},
		],
	},
	{
		id: "chatbot",
		titleKey: "guide.nav.category.chatbot",
		sections: [
			{
				id: "chatbot-basics",
				titleKey: "guide.nav.section.chatbot.basics",
				items: [
					{ id: "chatbot.start", titleKey: "guide.nav.item.chatbot.start" },
				],
			},
			{
				id: "chatbot-insights",
				titleKey: "guide.nav.section.chatbot.insights",
				items: [
					{
						id: "chatbot.summaries",
						titleKey: "guide.nav.item.chatbot.summaries",
					},
				],
			},
		],
	},
];
