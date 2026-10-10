import { NextResponse } from "next/server";
import { signIn } from "@/server/auth";
import { errorResponse } from "@/server/http";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await signIn(String(body.email ?? ""), String(body.password ?? ""));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
