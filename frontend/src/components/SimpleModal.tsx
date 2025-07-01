import { ReactNode } from "react";

export default function SimpleModal({
	title,
	onClose,
	onSubmit,
	children,
	disableSubmit,
}: {
	title: string;
	onClose: () => void;
	onSubmit: () => void;
	children: ReactNode;
	/** désactive le bouton Valider si true */
	disableSubmit?: boolean;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div className="card w-[28rem] max-w-full space-y-4">
				<h3 className="text-lg font-semibold">{title}</h3>

				{/* corps passé en props */}
				{children}

				<div className="flex justify-end gap-4 pt-2">
					<button className="btn-secondary" onClick={onClose}>
						Annuler
					</button>
					<button
						className="btn-primary"
						onClick={onSubmit}
						disabled={disableSubmit}>
						Valider
					</button>
				</div>
			</div>
		</div>
	);
}
