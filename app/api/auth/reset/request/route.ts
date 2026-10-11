import { NextResponse } from "next/server";
import { deliverResetLink, requestPasswordReset } from "@/server/recovery";
import { clientAddress, errorResponse } from "@/server/http";

/** The same reply whether or not the email has an account, so this can't be used to discover who plays. */
const REPLY = "If an account uses that email, a reset link is on its way. It works once, for 30 minutes.";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "");
    const { token } = await requestPasswordReset(email, clientAddress(req), new Date());
    if (token) deliverResetLink(email.trim().toLowerCase(), `${new URL(req.url).origin}/reset?token=${encodeURIComponent(token)}`);
    return NextResponse.json({ ok: true, message: REPLY });
  } catch (err) {
    return errorResponse(err);
  }
}
