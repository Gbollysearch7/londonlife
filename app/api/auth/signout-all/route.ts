import { NextResponse } from "next/server";
import { clearSessionCookie, requireAccount } from "@/server/auth";
import { signOutEverywhere } from "@/server/recovery";
import { errorResponse } from "@/server/http";

export async function POST() {
  try {
    const accountId = await requireAccount();
    await signOutEverywhere(accountId);
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
