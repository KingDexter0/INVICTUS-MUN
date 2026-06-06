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

  useEffect(() => {
    if (!isUnlocked) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setStatus("connecting");
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    function startSSE() {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }

      setStatus("connecting");
      const es = new EventSource("/api/admin/operations/updates");
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        setStatus("connected");
        retryCount = 0;
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
        es.close();
        eventSourceRef.current = null;
        retryCount++;

        if (retryCount <= maxRetries) {
          setStatus("connecting");
          setTimeout(startSSE, 2000);
        } else {
          startPolling();
        }
      };
    }

    function startPolling() {
      setStatus("polling");
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      // Poll database changes every 5 seconds as fallback
      pollIntervalRef.current = setInterval(() => {
        void triggerPollRefresh();
      }, 5000);
    }

    startSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [isUnlocked]);

  return { status };
}
