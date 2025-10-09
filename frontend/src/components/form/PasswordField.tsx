import { useId, useState, type InputHTMLAttributes } from "react";
import { useTranslation } from "../../language/useTranslation";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
	label?: string;
	containerClassName?: string;
	errorMessage?: string;
};

export default function PasswordField({
	label,
	containerClassName,
	className,
	id: providedId,
	errorMessage,
	disabled,
	...inputProps
}: PasswordFieldProps) {
	const [visible, setVisible] = useState(false);
	const generatedId = useId();
	const id = providedId ?? generatedId;
	const { t } = useTranslation();

	const toggleLabel = visible
		? t("common.password.hide")
		: t("common.password.show");

	const inputClassName = ["form-input", className].filter(Boolean).join(" ");

	return (
		<div className={["form-field", containerClassName].filter(Boolean).join(" ")}>
			{label && (
				<label className="form-label" htmlFor={id}>
					{label}
				</label>
			)}
			<div className="password-input">
				<input
					id={id}
					className={inputClassName}
					type={visible ? "text" : "password"}
					disabled={disabled}
					{...inputProps}
				/>
				<button
					type="button"
					className="password-input__toggle"
					onClick={() => setVisible((prev) => !prev)}
					aria-label={toggleLabel}
					title={toggleLabel}
					disabled={disabled}>
					<i
						className={`fas ${visible ? "fa-eye-slash" : "fa-eye"}`}
						aria-hidden="true"
					/>
				</button>
			</div>
			{errorMessage && <p className="form-helper">{errorMessage}</p>}
		</div>
	);
}
