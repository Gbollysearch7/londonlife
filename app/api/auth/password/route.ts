import { NextResponse } from "next/server";
import { currentSessionHash, requireAccount } from "@/server/auth";
import { changePassword } from "@/server/recovery";
import { errorResponse } from "@/server/http";

export async function POST(req: Request) {
  try {
    const accountId = await requireAccount();
    const body = await req.json();
    const { signedOutOthers } = await changePassword(accountId, String(body.current ?? ""), String(body.next ?? ""), await currentSessionHash(), new Date());
    const others = signedOutOthers === 1 ? "1 other device was signed out." : `${signedOutOthers} other devices were signed out.`;
    return NextResponse.json({ ok: true, message: `Password changed. ${signedOutOthers ? others : "You stay signed in here."}` });
  } catch (err) {
    return errorResponse(err);
  }
}
