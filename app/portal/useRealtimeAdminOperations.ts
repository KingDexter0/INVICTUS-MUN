import { useEffect, useState, useRef } from "react";

export type ConnectionStatus = "connected" | "connecting" | "error" | "polling";

interface RealtimeHookProps {
  isUnlocked: boolean;
  onDelegateUpdated: (data: any) => void;
  onDelegateCheckedIn: (data: any) => void;
  onCertificateUpdated: (data: any) => void;
  onRefreshNeeded: (data: any) => void;
  triggerPollRefresh: () => Promise<void>;
}

export function useRealtimeAdminOperations({
  isUnlocked,
  onDelegateUpdated,
  onDelegateCheckedIn,
  onCertificateUpdated,
  onRefreshNeeded,
  triggerPollRefresh
}: RealtimeHookProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef<number>(2000); // Start with 2s retry delay

  useEffect(() => {
    if (!isUnlocked) {
      cleanup();
      setStatus("connecting");
      return;
    }

    function cleanup() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    function startSSE() {
      cleanup();
      setStatus("connecting");

      console.log("[Realtime] Connecting to EventSource...");
      const es = new EventSource("/api/admin/operations/updates");
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log("[Realtime] EventSource connection opened.");
        setStatus("connected");
        retryDelayRef.current = 2000; // Reset retry delay on success
        if (pollIntervalRef.current) {
          console.log("[Realtime] Stopping fallback polling.");
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };

      es.addEventListener("connected", () => {
        setStatus("connected");
        retryDelayRef.current = 2000;
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      });

      // Handle ping event from server
      es.addEventListener("ping", () => {
        setStatus("connected");
      });

      es.addEventListener("delegate:updated", (e) => {
        try {
          const payload = JSON.parse(e.data);
          onDelegateUpdated(payload);
        } catch (err) {
          console.error("Error parsing delegate:updated event payload", err);
        }
      });

      es.addEventListener("delegate:checked-in", (e) => {
        try {
          const payload = JSON.parse(e.data);
          onDelegateCheckedIn(payload);
        } catch (err) {
          console.error("Error parsing delegate:checked-in event payload", err);
        }
      });

      es.addEventListener("certificate:updated", (e) => {
        try {
          const payload = JSON.parse(e.data);
          onCertificateUpdated(payload);
        } catch (err) {
          console.error("Error parsing certificate:updated event payload", err);
        }
      });

      es.addEventListener("operations:refresh-needed", (e) => {
        try {
          const payload = JSON.parse(e.data);
          onRefreshNeeded(payload);
        } catch (err) {
          console.error("Error parsing operations:refresh-needed event payload", err);
        }
      });

      es.onerror = () => {
        console.warn("[Realtime] EventSource error. Falling back to polling...");
        es.close();
        eventSourceRef.current = null;
        
        // Start polling immediately if not already running
        startPolling();

        // Schedule reconnection attempt with backoff
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, 30000); // Exponential backoff up to 30s
        console.log(`[Realtime] Reconnecting in ${delay}ms...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          startSSE();
        }, delay);
      };
    }

    function startPolling() {
      setStatus("polling");
      if (!pollIntervalRef.current) {
        console.log("[Realtime] Starting fallback polling (every 5 seconds).");
        pollIntervalRef.current = setInterval(() => {
          void triggerPollRefresh();
        }, 5000);
      }
    }

    startSSE();

    return () => {
      cleanup();
    };
  }, [isUnlocked]);

  return { status };
}
