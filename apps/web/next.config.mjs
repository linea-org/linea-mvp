import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@linea/ui'],
};

export default withSentryConfig(nextConfig, {
  // Suppress build output unless in CI
  silent: !process.env.CI,

  // Source map upload — requires SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT env vars
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps but remove them from the deployed bundle
  sourcemaps: { deleteSourcemapsAfterUpload: true },

  // Wider client-side upload catches more files
  widenClientFileUpload: true,

  // Proxy Sentry ingestion through the app to avoid ad-blockers
  tunnelRoute: '/monitoring',

  // Don't ship source map references in the client bundle
  hideSourceMaps: true,

  // Remove Sentry's own logger to save bytes
  disableLogger: true,
});
