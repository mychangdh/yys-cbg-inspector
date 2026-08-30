export type AppServerError = {
  code: "INTERNAL" | "UPSTREAM_UNAVAILABLE";
  message: string;
};
