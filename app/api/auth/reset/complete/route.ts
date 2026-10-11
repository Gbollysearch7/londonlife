import { NextResponse } from "next/server";
import { completePasswordReset } from "@/server/recovery";
import { clientAddress, errorResponse } from "@/server/http";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await completePasswordReset(String(body.token ?? ""), String(body.password ?? ""), clientAddress(req), new Date());
    return NextResponse.json({ ok: true, message: "Your password has been changed and every device was signed out. Sign in with your new password." });
  } catch (err) {
    return errorResponse(err);
  }
}
