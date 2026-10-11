import { NextResponse } from "next/server";
import { GameError } from "./db";

export function errorResponse(err: unknown) {
  if (err instanceof GameError) {
    return NextResponse.json({ ok: false, code: err.code, message: err.message }, { status: err.status });
  }
  console.error(err);
  return NextResponse.json(
    { ok: false, code: "server_error", message: "Something went wrong on our side. Nothing was charged; please try again." },
    { status: 500 },
  );
}

/** Best-effort client network address for throttling (first proxy hop, else a shared fallback bucket). */
export function clientAddress(req: Request) {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}
