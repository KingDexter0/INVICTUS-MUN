import { NextResponse } from "next/server";
import { assertAdmin } from "../../../../../lib/admin";
import { getActiveConnections, getLastEventAt } from "../../../../../lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAdmin();

    return NextResponse.json({
      success: true,
      sseRouteAvailable: true,
      authenticated: true,
      runtime: "nodejs",
      lastEventAt: getLastEventAt(),
      activeConnections: getActiveConnections()
    });
  } catch (error) {
    if ((error as Error).message === "UNAUTHORIZED") {
      return NextResponse.json({
        success: false,
        sseRouteAvailable: true,
        authenticated: false,
        runtime: "nodejs",
        error: "Admin access required."
      }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({
      success: false,
      sseRouteAvailable: false,
      error: "Internal server error."
    }, { status: 500 });
  }
}
