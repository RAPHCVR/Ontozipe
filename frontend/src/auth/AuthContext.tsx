import {
	createContext,
	useState,
	useContext,
	ReactNode,
	useEffect,
} from "react";

import { decodeJwt } from "../utils/jwt";
type User = {
	name?: string;
	email?: string;
	sub: string;
	roles?: string[];
};

type AuthCtx = {
	token: string | null;
	user: User | null;
	login: (t: string) => void;
	logout: () => void;
};

const Ctx = createContext<AuthCtx>({
	token: null,
	user: null,
	login: () => {},
	logout: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
	const [token, setToken] = useState<string | null>(() =>
		localStorage.getItem("jwt")
	);

	const login = (t: string) => {
		localStorage.setItem("jwt", t);
		setToken(t);
		setUser(decodeJwt<User>(t));
	};

	const logout = () => {
		localStorage.removeItem("jwt");
		setToken(null);
		setUser(null);
	};

	const [user, setUser] = useState<User | null>(() =>
		token ? decodeJwt<User>(token) : null
	);

	/* Auto-logout quand le JWT expire (exp dans payload) */
	useEffect(() => {
		if (!token) return;
		try {
			const { exp } = JSON.parse(atob(token.split(".")[1]));
			const delay = Math.max(exp * 1000 - Date.now(), 0);
			const id = setTimeout(logout, delay);
			return () => clearTimeout(id);
		} catch {
			logout();
		}
	}, [token]);

	return (
		<Ctx.Provider value={{ token, user, login, logout }}>
			{children}
		</Ctx.Provider>
	);
};

export const useAuth = () => useContext(Ctx);
