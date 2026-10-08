// Installed apps handle this Universal Link before the website fallback.
// Vercel static redirects retain query parameters: the set UUID must never
// become an App Store `id` parameter. This fallback reads no set or account data.
export const runtime = "edge";

export default function handler(): Response {
  return new Response(null, {
    status: 307,
    headers: {
      Location: "https://apps.apple.com/app/id6759216018",
      "Cache-Control": "no-store",
    },
  });
}
