"use client";

import { Provider } from "react-redux";
import type { ReactNode } from "react";
import { store } from "@/store";
import styles from "./index.module.scss";

type AppProvidersProps = { children: ReactNode };

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <Provider store={store}>
      <div className={styles.scope}>
        <div className="app-providers">{children}</div>
      </div>
    </Provider>
  );
}
