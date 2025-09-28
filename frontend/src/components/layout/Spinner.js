import { jsx as _jsx } from "react/jsx-runtime";
/** Loader centré plein-écran (Tailwind + animation CSS) */
export default function Spinner() {
    return (_jsx("div", { className: "min-h-[40vh] flex items-center justify-center", children: _jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500 border-opacity-50" }) }));
}
