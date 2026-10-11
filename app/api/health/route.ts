import { NextResponse } from "next/server";
import { pool } from "@/server/db";
import { healthReport, migrationFiles } from "@/server/platformHealth";

export const dynamic = "force-dynamic";

/**
 * Health check for load balancers and monitoring: 200 when the database answers and every migration is
 * applied, 503 otherwise. `?deep=1` also compares every character's cash with its ledger; in production that
 * heavier check needs the `x-health-token` header to match the HEALTH_TOKEN setting.
 */
export async function GET(req: Request) {
  const token = process.env.HEALTH_TOKEN;
  const allowedDeep = process.env.NODE_ENV !== "production" || (!!token && req.headers.get("x-health-token") === token);
  const deep = allowedDeep && new URL(req.url).searchParams.get("deep") === "1";
  const report = await healthReport(pool(), migrationFiles(), { deep });
  return NextResponse.json(report, { status: report.status === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
