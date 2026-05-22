import { createRoot } from "react-dom/client";
import "./styles.css";
import { AppShell } from "./app/AppShell";

createRoot(document.getElementById("root")!).render(<AppShell />);
