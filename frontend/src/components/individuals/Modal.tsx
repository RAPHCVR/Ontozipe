// ---------------------------------------------------------------------------
// Modal (updated to use IndividualCard)

import { IndividualNode, Snapshot } from "types";
import IndividualCard from "./IndividualCard";

// ---------------------------------------------------------------------------
const Modal: React.FC<{
	individual: IndividualNode;
	snapshot: Snapshot;
	onShow: (ind: IndividualNode) => void;
	onClose: () => void;
	zIndex: number;
}> = ({ individual, snapshot, onShow, onClose, zIndex }) => {
	return (
		<div
			className="fixed inset-0 bg-black/40 flex items-center justify-center"
			style={{ zIndex }}>
			<div className="bg-white dark:bg-slate-800 rounded-lg w-4/5 max-w-5xl p-6 space-y-4 shadow-lg">
				{" "}
				<IndividualCard
					ind={individual}
					snapshot={snapshot}
					onShow={onShow}
					onEdit={() => {}}
					onDelete={() => {}}
					idx={0}
					defaultOpen={true}
				/>
				<button
					onClick={onClose}
					className="btn-primary self-end mx-auto block">
					Quitter
				</button>
			</div>
		</div>
	);
};

export default Modal;
