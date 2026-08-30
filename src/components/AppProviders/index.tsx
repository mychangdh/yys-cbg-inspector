"use client";

import { Provider } from "react-redux";
import { store } from "@/store";
import type { AppProvidersProps } from "./index.types";
import "./index.scss";

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <div className="app-providers">{children}</div>
    </Provider>
  );
}
