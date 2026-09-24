// Per-deployment identity. The same codebase is deployed twice — the Senior
// Lifestyle app and the multi-brand app — each as its own Vercel project with
// its own URL and database. Each sets these at build time; the defaults are the
// Senior Lifestyle deployment's, so it needs no configuration.
//
// This is only the app's own identity. The brand whose AI visibility is being
// tracked (names, domain, sitemap) is per Project, not per deployment.

function env(value: string | undefined, fallback: string): string {
  return value === undefined ? fallback : value.trim()
}

// Shown ahead of the product name, e.g. "Senior Lifestyle" + "AI Visibility Dashboard".
export const APP_OWNER_NAME = env(process.env.NEXT_PUBLIC_APP_OWNER_NAME, 'Senior Lifestyle')
export const APP_PRODUCT_NAME = env(process.env.NEXT_PUBLIC_APP_PRODUCT_NAME, 'AI Visibility Dashboard')
export const APP_TITLE = [APP_OWNER_NAME, APP_PRODUCT_NAME].filter(Boolean).join(' ')

export const APP_DESCRIPTION = env(
  process.env.NEXT_PUBLIC_APP_DESCRIPTION,
  'Monitor AI mentions and citations for your senior living communities'
)

// Dashboard subtitle when no single project is selected.
export const APP_DASHBOARD_TAGLINE = env(
  process.env.NEXT_PUBLIC_APP_DASHBOARD_TAGLINE,
  'AI mention and citation monitoring across your senior living portfolio'
)

// Path under /public or an absolute URL. Set to an empty string to show
// APP_OWNER_NAME as a text wordmark instead.
export const APP_LOGO_URL = env(process.env.NEXT_PUBLIC_APP_LOGO_URL, '/sl-logo.png')

// "Senior Lifestyle" → "SL", for the small badge on shared pages.
export const APP_INITIALS =
  APP_OWNER_NAME.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'AI'
