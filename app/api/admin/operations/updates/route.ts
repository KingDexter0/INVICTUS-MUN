import { assertAdmin } from "../../../../../lib/admin";
import {
  operationsEmitter,
  incrementConnections,
  decrementConnections,
  setLastEventAt
} from "../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  // Increment active connection tracking
  incrementConnections();

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection success message
  void writer.write(encoder.encode("event: connected\ndata: {}\n\n")).catch(() => {});

  let cleaned = false;
  const cleanupConnection = () => {
    if (cleaned) return;
    cleaned = true;
    decrementConnections();
    clearInterval(pingInterval);
    operationsEmitter.off("update", onUpdate);
  };

  const onUpdate = async (event: { type: string; data: any }) => {
    setLastEventAt(new Date().toISOString());
    try {
      await writer.write(
        encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
      );
    } catch (err) {
      cleanupConnection();
    }
  };

  operationsEmitter.on("update", onUpdate);

  // Ping interval (15 seconds) to prevent timeout
  const pingInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode("event: ping\ndata: {}\n\n"));
    } catch {
      cleanupConnection();
    }
  }, 15000);

  // Handle connection close
  request.signal.addEventListener("abort", async () => {
    cleanupConnection();
    try {
      await writer.close();
    } catch {}
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no"
    },
  });
}
