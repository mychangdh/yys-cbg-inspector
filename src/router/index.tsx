import { Navigate, useRoutes } from "react-router-dom";
import { useAppSelector } from "@/store";
import { routes } from "./routes";
import "./index.scss";

export type { AppRoute } from "@/types/router";
export { APP_ROUTE_PATHS, getRouteFromPath } from "./routes";

export function AppRouter() {
  const dataset = useAppSelector((state) => state.app.dataset);
  const hasLoadedProduct =
    Boolean(dataset.account?.sourceUrl) ||
    Object.values(dataset.relicsByPosition || {}).some(
      (items) => items.length > 0,
    );
  return useRoutes(
    routes.map(({ path, element, children }) => ({
      path,
      element,
      children: children?.map(
        ({ path: childPath, element: childElement, requiresProduct }) => ({
          path: childPath,
          element:
            requiresProduct && !hasLoadedProduct ? (
              <Navigate to="/home" replace />
            ) : (
              childElement
            ),
        }),
      ),
    })),
  );
}
