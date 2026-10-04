import { createInvitePreviewHandler, createRpcLookup } from "../lib/invite-preview-handler.js";

export const runtime = "edge";

export const GET = createInvitePreviewHandler({
  supabaseUrl: process.env.SUPABASE_URL,
  lookup: createRpcLookup({
    supabaseUrl: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
});
