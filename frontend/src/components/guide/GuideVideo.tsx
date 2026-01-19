import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../language/useTranslation";

type GuideVideoProps = {
	videoId?: string;
};

const buildEmbedUrl = (videoId: string) =>
	`https://www.youtube-nocookie.com/embed/${videoId}`;

export default function GuideVideo({ videoId }: GuideVideoProps) {
	const { t } = useTranslation();
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		setLoaded(false);
	}, [videoId]);

	const embedUrl = useMemo(() => {
		if (!videoId) return "";
		return buildEmbedUrl(videoId);
	}, [videoId]);

	if (!videoId) {
		return (
			<div className="guide-video__empty card">
				<p>{t("guide.video.unavailable")}</p>
			</div>
		);
	}

	return (
		<div className="guide-video card">
			<div className="guide-video__frame">
				<iframe
					title={t("guide.video.aria")}
					src={embedUrl}
					allow="autoplay; encrypted-media; picture-in-picture"
					allowFullScreen
					onLoad={() => setLoaded(true)}
				/>
				{!loaded && (
					<div className="guide-video__skeleton" aria-hidden="true" />
				)}
			</div>
		</div>
	);
}
