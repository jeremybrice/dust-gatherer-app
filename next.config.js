/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep the Postgres driver out of the server bundle. Bundling is what broke
  // the previous database client — the Neon HTTP client reached the runtime
  // missing a method it defines on itself — so the driver is loaded as a plain
  // Node dependency instead of being traced and rewritten.
  serverExternalPackages: ["pg"],
};
