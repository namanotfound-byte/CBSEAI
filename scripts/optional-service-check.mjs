// Enabled only for an isolated deployment with production environment values.
// Ordinary builds never make provider requests.
if (process.env.RUN_CONNECTION_CHECK_AT_BUILD === "true") {
  await import("./check_services.mjs");
}
