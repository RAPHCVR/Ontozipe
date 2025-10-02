import { ReactNode } from "react";
import Navbar from "./NavBar";
import Footer from "./footer";

export default function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="app-shell">
			<Navbar />
			<main className="app-main" role="main">
				{children}
			</main>
			<Footer />
		</div>
	);
}
