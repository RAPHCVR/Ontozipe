import { useState } from "react";
import { useApi } from "../../lib/api";
import dayjs from "dayjs";

export default function CommentFormModal({
	parentInd,
	onClose,
	onSaved,
}: {
	parentInd: { id: string };
	onClose: () => void;
	onSaved: () => void;
}) {
	const api = useApi();
	const [text, setText] = useState("");

	const save = () =>
		api("http://localhost:4000/ontology/individuals", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: `http://example.org/va#comment-${Date.now()}`,
				label: `Comment ${dayjs().format("YYYY-MM-DD HH:mm")}`,
				classId: "http://example.org/va#Commentaire",
				properties: [
					{
						predicate: "http://example.org/va#texteCommentaire",
						value: text,
						isLiteral: true,
					},
					{
						predicate: "http://example.org/va#objetCommente",
						value: parentInd.id,
						isLiteral: false,
					},
				],
			}),
		})
			.then(onSaved)
			.finally(onClose);

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div className="card w-[26rem] space-y-4">
				<h3 className="font-semibold">Nouveau commentaire</h3>
				<textarea
					className="input h-28 resize-none"
					value={text}
					onChange={(e) => setText(e.target.value)}
				/>
				<div className="flex justify-end gap-4">
					<button className="btn-secondary" onClick={onClose}>
						Annuler
					</button>
					<button
						className="btn-primary"
						onClick={save}
						disabled={!text.trim()}>
						Publier
					</button>
				</div>
			</div>
		</div>
	);
}
