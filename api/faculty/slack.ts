import { WebClient } from "@slack/web-api";
import { createClient } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk";

export const runtime = "nodejs";

let slackClient: WebClient | null = null;

function getSlackClient(): WebClient {
  if (!slackClient) {
    slackClient = new WebClient(getEnv("SLACK_BOT_TOKEN"));
  }
  return slackClient;
}

type SlackUrlVerification = {
  type: "url_verification";
  challenge: string;
};

type SlackEventCallback = {
  type: "event_callback";
  event_id?: string;
  event?: Record<string, unknown>;
};

type SlackBlockActions = {
  type: "block_actions";
  team?: { id?: string };
  user?: { id?: string };
  trigger_id?: string;
  response_url?: string;
  message?: { ts?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
};

type SlackViewSubmission = {
  type: "view_submission";
  team?: { id?: string };
  user: { id: string };
  view: {
    id: string;
    callback_id?: string;
    private_metadata: string;
    state: { values: Record<string, Record<string, unknown>> };
  };
};

type SlackIngressPayload =
  | SlackUrlVerification
  | SlackEventCallback
  | SlackBlockActions
  | SlackViewSubmission;

type SlackBlock = Record<string, unknown>;

type ApprovalRow = {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  approver_id: string | null;
  approver_type: "user" | "role" | "agent" | null;
  visible_to: string[] | null;
  form_schema: {
    title: string;
    submit_label: string;
    blocks: SlackBlock[];
  } | null;
  trigger_dev_token: string;
  tweak_count: number;
};

const APPROVAL_ACTION_IDS = {
  approve: "faculty_approval_approve",
  reject: "faculty_approval_reject",
  tweak: "faculty_approval_tweak",
  openFormModal: "open_form_modal",
} as const;

function isSlackIngressPayload(value: unknown): value is SlackIngressPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;

  return (
    type === "url_verification" ||
    type === "event_callback" ||
    type === "block_actions" ||
    type === "view_submission"
  );
}

function getEnv(
  name: "SLACK_BOT_TOKEN" | "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY",
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value.trim();
}

function getSupabaseClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// Mirrors `messagingRespondToInteraction` in `reps-ops/triggers/faculty/lib/messaging/` - keep in sync.
// Cross-repo import isn't supported by the deploy chain.
async function respondToInteraction(
  responseUrl: string | undefined,
  body: Record<string, unknown>,
): Promise<void> {
  if (!responseUrl) {
    return;
  }

  await fetch(responseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function verifySlackSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  signingSecret: string,
): Promise<boolean> {
  if (!signature || !timestamp) {
    return false;
  }

  const age = Math.floor(Date.now() / 1000) - Number.parseInt(timestamp, 10);

  if (Math.abs(age) > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(baseString),
  );
  const computed =
    "v0=" +
    Array.from(new Uint8Array(signatureBytes))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

  if (computed.length !== signature.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < computed.length; index += 1) {
    mismatch |= computed.charCodeAt(index) ^ signature.charCodeAt(index);
  }

  return mismatch === 0;
}

function parseSlackBody(
  rawBody: string,
  contentType: string | null,
): SlackIngressPayload {
  let parsed: unknown;

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const payload = params.get("payload");

    if (!payload) {
      throw new Error("missing payload field in form-urlencoded body");
    }

    parsed = JSON.parse(payload);
  } else {
    parsed = JSON.parse(rawBody);
  }

  if (!isSlackIngressPayload(parsed)) {
    throw new Error("unrecognized Slack payload type");
  }

  return parsed;
}

function computeViewSubmissionIdempotencyKey(
  payload: SlackViewSubmission,
): string {
  return `view:${payload.team?.id ?? "?"}:${payload.user.id}:${payload.view.id}:${
    payload.view.callback_id ?? "?"
  }`;
}

function parseMetadata(
  privateMetadata: string,
): { approvalId: string; kind: "ideation" | "tweak"; oldTokenId?: string } | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(privateMetadata);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  if (
    typeof candidate.approvalId !== "string" ||
    (candidate.kind !== "ideation" && candidate.kind !== "tweak")
  ) {
    return null;
  }

  return {
    approvalId: candidate.approvalId,
    kind: candidate.kind,
    oldTokenId:
      typeof candidate.oldTokenId === "string" ? candidate.oldTokenId : undefined,
  };
}

function parseButtonValue(
  value: string | undefined,
): { approvalId: string; triggerDevToken?: string } | null {
  if (!value) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.approvalId !== "string") {
    return null;
  }

  return {
    approvalId: candidate.approvalId,
    triggerDevToken:
      typeof candidate.triggerDevToken === "string"
        ? candidate.triggerDevToken
        : undefined,
  };
}

async function getApprovalRow(approvalId: string): Promise<ApprovalRow | null> {
  const response = await getSupabaseClient()
    .schema("agents")
    .from("approvals")
    .select(
      "id,status,payload,approver_id,approver_type,visible_to,form_schema,trigger_dev_token,tweak_count",
    )
    .eq("id", approvalId)
    .maybeSingle<ApprovalRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data ?? null;
}

function isAuthorized(row: ApprovalRow, userId: string | undefined): boolean {
  if (!userId || row.status !== "pending") {
    return false;
  }

  const actor = userId.trim();

  if (row.approver_type === "user") {
    return (row.approver_id ?? "").trim() === actor;
  }

  if (row.approver_type === "role") {
    return row.visible_to?.map((id) => id.trim()).includes(actor) ?? false;
  }

  return false;
}

async function updateViewId(approvalId: string, viewId: string): Promise<void> {
  const response = await getSupabaseClient()
    .schema("agents")
    .from("approvals")
    .update({ view_id: viewId, updated_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("status", "pending");

  if (response.error) {
    throw response.error;
  }
}

async function slackViewsOpen(params: {
  triggerId: string;
  view: Record<string, unknown>;
}): Promise<{ viewId: string | null }> {
  // Cast through unknown: WebClient's types require the structured ModalView
  // shape but we build the view object locally with our own narrower SlackBlock
  // typing. The runtime payload matches Slack's API contract.
  const response = await getSlackClient().views.open({
    trigger_id: params.triggerId,
    view: params.view as unknown as Parameters<
      WebClient["views"]["open"]
    >[0]["view"],
  });

  if (!response.ok) {
    throw new Error(
      `Slack views.open failed: ${response.error ?? "unknown_error"}`,
    );
  }

  return { viewId: response.view?.id ?? null };
}

function buildTweakModalBlocks(roleTitle: string): SlackBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Designing *${roleTitle}*`,
      },
    },
    {
      type: "input",
      block_id: "block_tweak_note",
      label: {
        type: "plain_text",
        text: "What should change in this design?",
      },
      element: {
        type: "plain_text_input",
        action_id: "action_tweak_note",
        multiline: true,
      },
    },
  ];
}

async function forwardToFacultyWebhook(
  payload: SlackIngressPayload,
  idempotencyKey: string | undefined,
): Promise<void> {
  await tasks.trigger("faculty-slack-webhook", payload, { idempotencyKey });
}

async function handleViewSubmission(
  payload: SlackViewSubmission,
): Promise<Response> {
  const metadata = parseMetadata(payload.view.private_metadata);

  if (!metadata) {
    return Response.json({});
  }

  try {
    await forwardToFacultyWebhook(
      payload,
      computeViewSubmissionIdempotencyKey(payload),
    );
    return Response.json({});
  } catch (triggerError) {
    console.error("Failed to enqueue view_submission to Trigger.dev", {
      triggerError,
      viewId: payload.view.id,
    });
    const firstInputBlockId = Object.keys(payload.view.state.values)[0];

    return Response.json({
      response_action: "errors",
      errors: firstInputBlockId
        ? {
            [firstInputBlockId]:
              "Could not save this response. Please submit again.",
          }
        : { _modal: "Could not save this response. Please submit again." },
    });
  }
}

async function handleOpenFormModal(
  payload: SlackBlockActions,
  approvalId: string,
): Promise<Response> {
  const row = await getApprovalRow(approvalId);

  if (!row || !isAuthorized(row, payload.user?.id)) {
    return Response.json({});
  }

  if (!row.form_schema) {
    return Response.json({});
  }

  const triggerId = payload.trigger_id?.trim();

  if (!triggerId) {
    console.error("Missing Slack trigger_id for form modal", { approvalId });
    return Response.json({});
  }

  try {
    const response = await slackViewsOpen({
      triggerId,
      view: {
        type: "modal",
        callback_id: row.id,
        private_metadata: JSON.stringify({ approvalId: row.id, kind: "ideation" }),
        title: { type: "plain_text", text: row.form_schema.title },
        submit: { type: "plain_text", text: row.form_schema.submit_label },
        blocks: row.form_schema.blocks,
        notify_on_close: false,
      },
    });
    const viewId = response.viewId;

    if (viewId) {
      await updateViewId(row.id, viewId);
    }
  } catch (error) {
    console.error("Slack views.open failed for form modal", { approvalId, error });
    // Telemetry: surface the underlying Slack error inline so we can diagnose
    // from the click side. Generic copy hid the actual failure (invalid_blocks,
    // expired_trigger_id, missing_scope, etc.) for ~3 sessions of debugging.
    const detail =
      error instanceof Error
        ? `${error.message}`
        : typeof error === "string"
          ? error
          : "unknown_error";
    await respondToInteraction(payload.response_url, {
      response_type: "ephemeral",
      text: `Couldn't open the form: \`${detail}\` (approvalId=\`${approvalId}\`). Click again to retry; report this text if it persists.`,
    });
  }

  return Response.json({});
}

async function handleTweakModal(payload: SlackBlockActions): Promise<Response> {
  const action = payload.actions?.[0];
  const parsed = parseButtonValue(action?.value);

  if (!parsed) {
    return Response.json({});
  }

  const row = await getApprovalRow(parsed.approvalId);

  if (!row || !isAuthorized(row, payload.user?.id)) {
    return Response.json({});
  }

  if (row.trigger_dev_token !== parsed.triggerDevToken) {
    await respondToInteraction(payload.response_url, {
      response_type: "ephemeral",
      text: "This approval has moved to a newer iteration.",
    });
    return Response.json({});
  }

  if (row.tweak_count >= 2) {
    await respondToInteraction(payload.response_url, {
      response_type: "ephemeral",
      text: "Tweak limit reached — please Approve or Reject.",
    });
    return Response.json({});
  }

  const triggerId = payload.trigger_id?.trim();

  if (!triggerId) {
    console.error("Missing Slack trigger_id for tweak modal", {
      approvalId: row.id,
    });
    return Response.json({});
  }

  const roleTitle =
    typeof row.payload.roleTitle === "string" ? row.payload.roleTitle : "agent";

  try {
    const response = await slackViewsOpen({
      triggerId,
      view: {
        type: "modal",
        callback_id: row.id,
        private_metadata: JSON.stringify({
          approvalId: row.id,
          kind: "tweak",
          oldTokenId: row.trigger_dev_token,
        }),
        title: { type: "plain_text", text: "Request tweak" },
        submit: { type: "plain_text", text: "Submit" },
        blocks: buildTweakModalBlocks(roleTitle),
        notify_on_close: false,
      },
    });
    const viewId = response.viewId;

    if (viewId) {
      await updateViewId(row.id, viewId);
    }
  } catch (error) {
    console.error("Slack views.open failed for tweak modal", {
      approvalId: row.id,
      error,
    });
    // Telemetry: same rationale as handleOpenFormModal — surface the actual
    // underlying Slack error so we don't burn cycles guessing.
    const detail =
      error instanceof Error
        ? `${error.message}`
        : typeof error === "string"
          ? error
          : "unknown_error";
    await respondToInteraction(payload.response_url, {
      response_type: "ephemeral",
      text: `Couldn't open the tweak form: \`${detail}\` (approvalId=\`${row.id}\`). Click again to retry; report this text if it persists.`,
    });
  }

  return Response.json({});
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-slack-signature");
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const contentType = request.headers.get("content-type");
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    return new Response("misconfigured", { status: 500 });
  }

  const isValid = await verifySlackSignature(
    rawBody,
    signature,
    timestamp,
    signingSecret,
  );

  if (!isValid) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: SlackIngressPayload;

  try {
    payload = parseSlackBody(rawBody, contentType);
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  if (payload.type === "view_submission") {
    return handleViewSubmission(payload);
  }

  if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    const actionId = action?.action_id ?? "";

    if (actionId.startsWith(`${APPROVAL_ACTION_IDS.openFormModal}_`)) {
      const approvalId = actionId.slice(
        `${APPROVAL_ACTION_IDS.openFormModal}_`.length,
      );
      return handleOpenFormModal(payload, approvalId);
    }

    if (actionId === APPROVAL_ACTION_IDS.tweak) {
      return handleTweakModal(payload);
    }
  }

  let idempotencyKey: string | undefined;

  if (payload.type === "event_callback") {
    idempotencyKey = payload.event_id;
  } else if (payload.type === "block_actions") {
    const action = payload.actions?.[0];
    idempotencyKey = [
      payload.team?.id ?? "",
      payload.user?.id ?? "",
      payload.message?.ts ?? "",
      action?.action_id ?? "",
      action?.value ?? "",
    ].join(":");
  }

  try {
    await forwardToFacultyWebhook(payload, idempotencyKey);
  } catch (error) {
    console.error("faculty trigger failed", error, { payloadType: payload.type });

    if (payload.type === "event_callback") {
      return new Response("trigger failed", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
