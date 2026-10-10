import { NextResponse } from "next/server";
import { signUp } from "@/server/auth";
import { errorResponse } from "@/server/http";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await signUp(String(body.email ?? ""), String(body.password ?? ""), body.adult === true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
