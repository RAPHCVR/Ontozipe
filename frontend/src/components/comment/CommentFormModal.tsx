import { useState } from "react";
import { useApi } from "../../lib/api";
import dayjs from "dayjs";
import { useTranslation } from "../../language/useTranslation";

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
	const params = new URLSearchParams(window.location.search);
	const ontologyIri = params.get("iri") || "";
    const { t } = useTranslation();

	const save = () =>
		api("/individuals", {
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
				ontologyIri,
			}),
		})
			.then(onSaved)
			.finally(onClose);

	return (
		<div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
			<div className="card w-[26rem] space-y-4">
				<h3 className="font-semibold">{t("comment.form.title")}</h3>
				<textarea
					className="input h-28 resize-none"
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder={t("comment.form.placeholder")}
				/>
				<div className="flex justify-end gap-4">
					<button className="btn-secondary" onClick={onClose}>
						{t("common.cancel")}
					</button>
					<button
						className="btn-primary"
						onClick={save}
						disabled={!text.trim()}>
						{t("comment.form.submit")}
					</button>
				</div>
			</div>
		</div>
	);
}
