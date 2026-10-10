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
