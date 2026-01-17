import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "../../language/useTranslation";
import type { TranslationKey } from "../../language/messages";
import type { GuideContentEntry, GuideCalloutType } from "../../guide/guideTypes";
import GuideVideo from "./GuideVideo";

type GuideContentProps = {
	entry?: GuideContentEntry;
	categoryLabel?: string;
};

const calloutTitleKey: Record<GuideCalloutType, TranslationKey> = {
	warning: "guide.callout.warning.title",
	tip: "guide.callout.tip.title",
	note: "guide.callout.note.title",
};

const resolveVideoId = (entry?: GuideContentEntry): string | undefined => {
	if (!entry) return undefined;
	if (entry.youtubeVideoId) return entry.youtubeVideoId;
	if (!entry.youtubeUrl) return undefined;
	try {
		const url = new URL(entry.youtubeUrl);
		if (url.hostname.includes("youtu.be")) {
			return url.pathname.replace("/", "");
		}
		return url.searchParams.get("v") ?? undefined;
	} catch {
		return undefined;
	}
};

export default function GuideContent({ entry, categoryLabel }: GuideContentProps) {
	const { t } = useTranslation();

	if (!entry) {
		return (
			<div className="guide-content__empty card">
				<h2>{t("guide.empty.title")}</h2>
				<p>{t("guide.empty.subtitle")}</p>
			</div>
		);
	}

	const markdown = t(entry.markdownKey);
	const videoId = resolveVideoId(entry);

	return (
		<div className="guide-content" key={entry.id}>
			<div className="guide-content__header">
				{categoryLabel && (
					<span className="guide-content__badge">{categoryLabel}</span>
				)}
				<h2>{t(entry.titleKey)}</h2>
				<p>{t(entry.summaryKey)}</p>
			</div>

			<div className="guide-content__layout">
				<div className="guide-content__main">
					<div className="guide-markdown card">
						<div className="guide-markdown__title">
							<span>{t("guide.readme.title")}</span>
						</div>
						<ReactMarkdown remarkPlugins={[remarkGfm]}>
							{markdown}
						</ReactMarkdown>
					</div>

					{entry.steps && entry.steps.length > 0 && (
						<div className="guide-steps card">
							<div className="guide-steps__title">
								{t("guide.steps.title")}
							</div>
							<ol>
								{entry.steps.map((step, index) => (
									<li key={`${entry.id}-step-${index}`}>
										<span className="guide-steps__index">{index + 1}</span>
										<span className="guide-steps__text">
											{t(step.textKey)}
										</span>
										{step.timestamp && (
											<span className="guide-steps__timestamp">
												{step.timestamp}
											</span>
										)}
									</li>
								))}
							</ol>
						</div>
					)}

					{entry.callouts && entry.callouts.length > 0 && (
						<div className="guide-callouts">
							{entry.callouts.map((callout, index) => (
								<div
									key={`${entry.id}-callout-${index}`}
									className={`guide-callout guide-callout--${callout.type}`}>
									<div className="guide-callout__title">
										{t(calloutTitleKey[callout.type])}
									</div>
									<p>{t(callout.textKey)}</p>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="guide-content__aside">
					<GuideVideo videoId={videoId} />
				</div>
			</div>
		</div>
	);
}
