import { useEffect, useLayoutEffect, useState } from "react";

export type AppRoute =
  "overview" | "relics" | "calculator" | "speed" | "pve" | "hero-skills";

const ROUTE_HASHES: Record<AppRoute, string> = {
  overview: "#/overview",
  relics: "#/relics",
  calculator: "#/calculator",
  speed: "#/speed",
  pve: "#/pve",
  "hero-skills": "#/hero-skills",
};

export function getRouteFromHash(hash = window.location.hash): AppRoute {
  if (hash === ROUTE_HASHES.relics) {
    return "relics";
  }

  if (hash === ROUTE_HASHES.calculator) {
    return "calculator";
  }

  if (hash === ROUTE_HASHES.speed) {
    return "speed";
  }

  if (hash === ROUTE_HASHES.pve) {
    return "pve";
  }

  if (hash === ROUTE_HASHES["hero-skills"]) {
    return "hero-skills";
  }

  return "overview";
}

export function getHashForRoute(route: AppRoute): string {
  return ROUTE_HASHES[route];
}

export function useAppRouter() {
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromHash());

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Reset before the new route is painted so switching pages does not flash at
  // the previous scroll position on desktop browsers.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  const navigate = (route: AppRoute) => {
    const hash = getHashForRoute(route);

    // 先更新 React 路由状态，让点击后的内容立即进入平移动画；hash 仅负责地址同步。
    setRoute(route);

    if (window.location.hash !== hash) {
      window.location.hash = hash;
    }
  };

  return { route, navigate };
}
