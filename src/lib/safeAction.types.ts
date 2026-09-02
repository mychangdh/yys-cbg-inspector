export type AppServerError = {
  code: "INTERNAL" | "UPSTREAM_UNAVAILABLE" | "UPSTREAM_RISK_CONTROL";
  message: string;
};
