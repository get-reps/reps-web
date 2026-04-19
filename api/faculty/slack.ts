import { tasks } from "@trigger.dev/sdk";

export const runtime = "edge";

// Narrow parsed Slack payloads at the trust boundary. The ingress only cares
// about enough shape to (a) route on `type`, (b) short-circuit on
// `url_verification`, and (c) compute an idempotency key. Deeper
// type-narrowing happens in the Trigger.dev task payload.
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
  message?: { ts?: string };
  actions?: Array<{ action_id?: string; value?: string }>;
};

type SlackIngressPayload =
  | SlackUrlVerification
  | SlackEventCallback
  | SlackBlockActions;

function isSlackIngressPayload(value: unknown): value is SlackIngressPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;

  return (
    type === "url_verification" ||
    type === "event_callback" ||
    type === "block_actions"
  );
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
    await tasks.trigger("faculty-slack-webhook", payload, { idempotencyKey });
  } catch (error) {
    console.error("faculty trigger failed", error, { payloadType: payload.type });

    if (payload.type === "event_callback") {
      return new Response("trigger failed", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  }

  return new Response("ok", { status: 200 });
}
