import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "../language/useTranslation";

export default function SimpleModal({
	title,
	onClose,
	onSubmit,
	children,
	disableSubmit,
	submitLabel,
	cancelLabel,
	size = "md",
}: {
	title: string;
	onClose: () => void;
	onSubmit?: () => void | boolean | Promise<void | boolean>;
	children: ReactNode;
	/** désactive le bouton Valider si true */
	disableSubmit?: boolean;
	submitLabel?: string;
	cancelLabel?: string;
    size?: "sm" | "md" | "lg";
}) {
	const [closing, setClosing] = useState(false);
	const timeouts = useRef<number[]>([]);

	useEffect(() => {
		return () => {
			timeouts.current.forEach((id) => window.clearTimeout(id));
		};
	}, []);

	const scheduleClose = useCallback(() => {
		if (closing) return;
		setClosing(true);
		const timeout = window.setTimeout(() => {
			onClose();
		}, 220);
		timeouts.current.push(timeout);
	}, [closing, onClose]);

	const { t } = useTranslation();

	return (
		<div
			className={`modal-backdrop${closing ? " is-leaving" : ""}`}
			role="presentation"
			onClick={scheduleClose}>
			<div
				className={`modal modal--${size}`}
				role="dialog"
				aria-modal="true"
				onClick={(event) => event.stopPropagation()}>
				<header className="modal__header">
					<h3 className="modal__title">{title}</h3>
					<button
						type="button"
						className="modal__close"
						onClick={scheduleClose}
						aria-label={t("modal.closeAria")}
					>
						<i className="fas fa-times" aria-hidden="true" />
					</button>
				</header>

				<div className="modal__body">{children}</div>

				<footer className="modal__footer">
					<button
						type="button"
						className="button button--ghost"
						onClick={scheduleClose}>
						{cancelLabel ?? t("common.cancel")}
					</button>
					<button
						className="button button--primary"
						onClick={async () => {
							if (disableSubmit) return;
							if (!onSubmit) {
								scheduleClose();
								return;
							}
							try {
								const result = await onSubmit();
								if (result === false) return;
								scheduleClose();
							} catch (error) {
								console.error(error);
							}
						}}
						disabled={disableSubmit}>
						{submitLabel ?? t("common.confirm")}
					</button>
				</footer>
			</div>
		</div>
	);
}
