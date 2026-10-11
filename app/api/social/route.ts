import { NextResponse } from "next/server";
import { requireAccount } from "@/server/auth";
import { socialQueryFor } from "@/server/commands";
import { errorResponse } from "@/server/http";

export const dynamic = "force-dynamic";

/** Read-only social queries: ?op=search|online|profile|thread|rankings|feed|pulse plus that query's parameters. */
export async function GET(req: Request) {
  try {
    const accountId = await requireAccount();
    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams.entries());
    const result = await socialQueryFor(accountId, params.op ?? "", params);
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
