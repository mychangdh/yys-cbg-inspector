import "./src/styles/index.scss";
import "./src/styles/app-shell.scss";
import { createRoot } from "react-dom/client";
import { App } from "./src/App";

createRoot(document.getElementById("root")!).render(<App />);
