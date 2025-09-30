import { useTranslation } from "../../language/useTranslation";

const Footer = () => {
	const { t } = useTranslation();
	const year = new Date().getFullYear();

	return (
		<footer className="bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-400 text-xs py-4">
			<div className="container text-center">
				{t("footer.copyright", { year })}
			</div>
		</footer>
	);
};

export default Footer;
