import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../language/useTranslation";

type GuideVideoProps = {
	videoId?: string;
};

const buildEmbedUrl = (videoId: string, muted: boolean) => {
	const params = new URLSearchParams({
		autoplay: "1",
		mute: muted ? "1" : "0",
		loop: "1",
		playlist: videoId,
		playsinline: "1",
		rel: "0",
		modestbranding: "1",
	});
	return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

export default function GuideVideo({ videoId }: GuideVideoProps) {
	const { t } = useTranslation();
	const [loaded, setLoaded] = useState(false);
	const [manualStart, setManualStart] = useState(false);
	const [showFallback, setShowFallback] = useState(false);
	const [playerKey, setPlayerKey] = useState(0);

	useEffect(() => {
		setLoaded(false);
		setManualStart(false);
		setShowFallback(false);
		if (!videoId) return;
		const timer = window.setTimeout(() => setShowFallback(true), 1800);
		return () => window.clearTimeout(timer);
	}, [videoId]);

	const embedUrl = useMemo(() => {
		if (!videoId) return "";
		return buildEmbedUrl(videoId, !manualStart);
	}, [videoId, manualStart]);

	if (!videoId) {
		return (
			<div className="guide-video__empty card">
				<p>{t("guide.video.unavailable")}</p>
			</div>
		);
	}

	return (
		<div className="guide-video card">
			<div className="guide-video__header">
				<span>{t("guide.video.title")}</span>
				<span className="guide-video__chip">{t("guide.video.badge")}</span>
			</div>
			<div className="guide-video__frame">
				<iframe
					key={playerKey}
					title={t("guide.video.aria")}
					src={embedUrl}
					allow="autoplay; encrypted-media; picture-in-picture"
					allowFullScreen
					onLoad={() => setLoaded(true)}
				/>
				{!loaded && <div className="guide-video__skeleton" aria-hidden="true" />}
				{showFallback && (
					<button
						type="button"
						className="guide-video__fallback"
						onClick={() => {
							setManualStart(true);
							setPlayerKey((value) => value + 1);
							setShowFallback(false);
						}}>
						<span>{t("guide.video.play")}</span>
					</button>
				)}
			</div>
			<p className="guide-video__hint">{t("guide.video.hint")}</p>
		</div>
	);
}
