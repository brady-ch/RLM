import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./styles.css";
import { AppShell } from "./app/AppShell";

createRoot(document.getElementById("root")!).render(<AppShell />);
