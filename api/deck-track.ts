/* ============================================================================
   POST /api/deck-track  {events:[{kind, slide, slide_index, ms, duration_ms?}]}
   ----------------------------------------------------------------------------
   The deck page reports slide time and video time here with sendBeacon. Needs a
   valid session cookie; the visit is derived from it, never from the body. All
   behaviour lives in lib/deck-followup.ts (handleTrack) so it can be tested.
   ========================================================================== */
import { secret } from "../lib/deck-gate.js";
import { handleTrack, trackPreflight } from "../lib/deck-followup.js";
import { storeFromEnv } from "../lib/deck-visit-store.js";

export const runtime = "edge";

export async function OPTIONS(): Promise<Response> {
  return trackPreflight();
}

export async function POST(request: Request): Promise<Response> {
  return handleTrack(request, { secret: secret(), store: storeFromEnv() });
}
