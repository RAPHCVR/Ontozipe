import { createRoot } from "react-dom/client";
import App from "./App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./components/ui/ToastProvider";
import "./styles/index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root") as HTMLElement).render(
    <QueryClientProvider client={queryClient}>
        <ToastProvider>
            <App />
        </ToastProvider>
    </QueryClientProvider>
);
