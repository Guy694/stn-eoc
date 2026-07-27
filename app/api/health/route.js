import { query } from "@/lib/db";

export async function GET() {
  const startedAt = Date.now();
  try {
    await query("SELECT 1 AS healthy", []);
    return Response.json({
      success: true,
      status: "healthy",
      checks: { database: "up" },
      response_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({
      success: false,
      status: "unhealthy",
      checks: { database: "down" },
      response_ms: Date.now() - startedAt,
      checked_at: new Date().toISOString(),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
