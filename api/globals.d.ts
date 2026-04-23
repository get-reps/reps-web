// Edge runtime exposes process.env at runtime (Vercel shim), but we deliberately
// do not pull in @types/node to avoid bleeding Node types into edge code.
declare const process: {
  env: Record<string, string | undefined>;
};
