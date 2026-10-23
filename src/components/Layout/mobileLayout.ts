import { createContext, useContext } from "react";

export const MobileLayoutContext = createContext(false);

export const useMobileLayout = () => useContext(MobileLayoutContext);
