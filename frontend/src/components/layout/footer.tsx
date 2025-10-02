import { useTranslation } from "../../language/useTranslation";

const Footer = () => {
	const { t } = useTranslation();
	const year = new Date().getFullYear();

	return (
		<footer className="app-footer">
			<div className="app-container app-footer__inner">
				<span>
					© {new Date().getFullYear()} · {t("footer.copyright", { year })}
				</span>
			</div>
		</footer>
	);
};

export default Footer;
