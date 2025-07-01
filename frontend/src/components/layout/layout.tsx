import { ReactNode } from "react";
import Navbar from "./NavBar";
import Footer from "./footer";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-900">
			<Navbar />
			<main className="flex-grow flex flex-row px-2 py-4 min-h-0">
				{children}
			</main>
			<Footer />
		</div>
	);
}
