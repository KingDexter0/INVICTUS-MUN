import { assertAdmin } from "../../../../../lib/admin";
import { operationsEmitter } from "../../../../../lib/events";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection success message
  void writer.write(encoder.encode("event: connected\ndata: {}\n\n")).catch(() => {});

  const onUpdate = async (event: { type: string; data: any }) => {
    try {
      await writer.write(
        encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
      );
    } catch (err) {
      clearInterval(pingInterval);
      operationsEmitter.off("update", onUpdate);
    }
  };

  operationsEmitter.on("update", onUpdate);

  // Ping interval (15 seconds) to prevent timeout
  const pingInterval = setInterval(async () => {
    try {
      await writer.write(encoder.encode("event: ping\ndata: {}\n\n"));
    } catch {
      clearInterval(pingInterval);
      operationsEmitter.off("update", onUpdate);
    }
  }, 15000);

  // Handle connection close
  request.signal.addEventListener("abort", async () => {
    clearInterval(pingInterval);
    operationsEmitter.off("update", onUpdate);
    try {
      await writer.close();
    } catch {}
  });

  return new Response(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
