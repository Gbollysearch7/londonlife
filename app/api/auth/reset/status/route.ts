import { NextResponse } from "next/server";
import { resetLinkStatus } from "@/server/recovery";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

/** Lets the reset page say up front whether a link is still usable. It does not use the link up. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, status: await resetLinkStatus(String(body.token ?? ""), new Date()) });
  } catch (err) {
    return errorResponse(err);
  }
}
