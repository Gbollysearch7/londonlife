import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { loadStateFor } from "@/server/commands";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accountId = await requireAccount();
    return NextResponse.json(await loadStateFor(accountId), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
