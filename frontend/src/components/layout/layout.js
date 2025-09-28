import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Navbar from "./NavBar";
import Footer from "./footer";
export default function Layout({ children }) {
    return (_jsxs("div", { className: "flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900", children: [_jsx(Navbar, {}), _jsx("main", { className: "flex-grow flex flex-row px-2 py-4 min-h-0", children: children }), _jsx(Footer, {})] }));
}
