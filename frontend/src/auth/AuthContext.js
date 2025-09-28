import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useState, useContext, useEffect, } from "react";
import { decodeJwt } from "../utils/jwt";
const Ctx = createContext({
    token: null,
    user: null,
    login: () => { },
    logout: () => { },
});
export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem("jwt"));
    const login = (t) => {
        localStorage.setItem("jwt", t);
        setToken(t);
        setUser(decodeJwt(t));
    };
    const logout = () => {
        localStorage.removeItem("jwt");
        setToken(null);
        setUser(null);
    };
    const [user, setUser] = useState(() => token ? decodeJwt(token) : null);
    /* Auto-logout quand le JWT expire (exp dans payload) */
    useEffect(() => {
        if (!token)
            return;
        try {
            const { exp } = JSON.parse(atob(token.split(".")[1]));
            const delay = Math.max(exp * 1000 - Date.now(), 0);
            const id = setTimeout(logout, delay);
            return () => clearTimeout(id);
        }
        catch {
            logout();
        }
    }, [token]);
    return (_jsx(Ctx.Provider, { value: { token, user, login, logout }, children: children }));
};
export const useAuth = () => useContext(Ctx);
