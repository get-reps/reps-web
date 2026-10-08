// Installed apps handle this Universal Link before the website fallback.
// Vercel static redirects retain query parameters: the set UUID must never
// become an App Store `id` parameter. This fallback reads no set or account data.
// Named Web handlers match this site's Vercel Node.js runtime. A default
// function export is treated as a Node req/res handler and its returned
// Response is not sent to the browser.
export function GET(): Response {
  return new Response(null, {
    status: 307,
    headers: {
      Location: "https://apps.apple.com/app/id6759216018",
      "Cache-Control": "no-store",
    },
  });
}

export const HEAD = GET;
