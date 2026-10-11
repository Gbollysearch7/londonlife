import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { loadTableFor } from "@/server/commands";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

/** One games table's public state, polled by the board overlay (players and spectators). */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccount();
    const id = new URL(req.url).searchParams.get("id");
    return NextResponse.json(await loadTableFor(accountId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
