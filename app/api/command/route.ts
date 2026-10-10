import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { loadStateFor, runCommand } from "@/server/commands";
import { errorResponse } from "@/server/http";

export async function POST(req: Request) {
  try {
    const accountId = await requireAccount();
    const body = await req.json();
    const result = await runCommand(accountId, body.key, body.type, body.payload);
    const state = await loadStateFor(accountId);
    return NextResponse.json({ ...result, state });
  } catch (err) {
    return errorResponse(err);
  }
}
