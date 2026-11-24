// Public configuration for /oauth/consent (reps-backend/work/chatgpt-plugin-261104/PLAN.md §1.3).
// reps-web has no build step, and login.html hardcodes production; this lets one static
// page serve a staging deployment and production from env alone. Everything returned is
// public by design (the anon key ships in every app binary). Unset → 503, so a deploy that
// forgot the env fails loudly on the page instead of signing users into the wrong project.

export function GET(): Response {
  const supabaseUrl = process.env.OAUTH_SUPABASE_URL ?? "";
  const anonKey = process.env.OAUTH_SUPABASE_ANON_KEY ?? "";
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl) || anonKey.length < 20) {
    console.warn("[oauth-config] OAUTH_SUPABASE_URL / OAUTH_SUPABASE_ANON_KEY missing or malformed");
    return Response.json({ error: "not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(
    {
      supabaseUrl,
      anonKey,
      // Staging only: lets MCP Inspector / local test callbacks reach the Allow button.
      allowDevCallbacks: process.env.OAUTH_ALLOW_DEV_CALLBACKS === "true",
      // Provider buttons render only when the project has a WEB client for them
      // (PREFLIGHT.md 0.2: prod Google yes, Apple needs a Services ID first).
      google: process.env.OAUTH_GOOGLE_ENABLED === "true",
      apple: process.env.OAUTH_APPLE_ENABLED === "true",
      // Email codes only once Supabase Auth sends mail through Resend with a {{ .Token }}
      // template (PREFLIGHT.md 0.1) — until then real users would never receive the code.
      emailCode: process.env.OAUTH_EMAIL_CODE_ENABLED === "true",
      // Public PostHog project key for the consent-funnel beacon; unset → no events.
      posthogKey: process.env.OAUTH_POSTHOG_KEY ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const HEAD = GET;
