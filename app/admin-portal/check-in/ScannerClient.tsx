"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type DelegateDetails = {
  id?: string;
  publicId?: string;
  name?: string;
  email?: string;
  committee?: string | null;
  portfolio?: string | null;
};

type CheckInResult = {
  success: boolean;
  status: "CHECKED_IN" | "ALREADY_CHECKED_IN" | "INVALID" | "UNAUTHORIZED" | "ERROR";
  message: string;
  delegate?: DelegateDetails;
  checkedInAt?: string | null;
};

const READER_ID = "invictus-admin-qr-reader";

function parseQrValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    return decodeURIComponent(parts.at(-1) || "");
  } catch {
    const withoutQuery = trimmed.split(/[?#]/)[0].replace(/\/+$/, "");
    const parts = withoutQuery.split("/").filter(Boolean);
    return decodeURIComponent(parts.at(-1) || withoutQuery);
  }
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function resultClass(status: CheckInResult["status"]) {
  if (status === "CHECKED_IN") return "success";
  if (status === "ALREADY_CHECKED_IN") return "warning";
  return "error";
}

function resultTitle(status: CheckInResult["status"]) {
  if (status === "CHECKED_IN") return "Delegate checked in";
  if (status === "ALREADY_CHECKED_IN") return "Already checked in";
  if (status === "UNAUTHORIZED") return "Admin access required";
  return "Invalid QR code";
}

export function AdminQrScanner() {
  const scannerRef = useRef<any>(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(false);
  const [scannerState, setScannerState] = useState<"starting" | "scanning" | "processing" | "stopped">("starting");
  const [cameraError, setCameraError] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      await scanner.stop();
    } catch {
      // The library throws if stop is called before the camera is fully active.
    }

    try {
      await scanner.clear();
    } catch {
      // Clearing is best-effort during route transitions.
    }

    scannerRef.current = null;
    if (mountedRef.current) setScannerState("stopped");
  }, []);

  const submitCode = useCallback(async (rawValue: string) => {
    const id = parseQrValue(rawValue);
    if (!id) {
      setResult({ success: false, status: "INVALID", message: "The scanned QR code did not contain a pass ID." });
      return;
    }

    setScannerState("processing");
    setCameraError("");

    try {
      const response = await fetch(`/api/verify/pass/${encodeURIComponent(id)}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "admin-scanner" })
      });
      const payload = await response.json().catch(() => ({}));

      setResult({
        success: Boolean(payload.success),
        status: payload.status || (response.ok ? "CHECKED_IN" : "ERROR"),
        message: payload.message || payload.error || "Could not check in delegate.",
        delegate: payload.delegate,
        checkedInAt: payload.checkedInAt || payload.registration?.checkedInAt || null
      });
    } catch {
      setResult({ success: false, status: "ERROR", message: "Could not reach the check-in server. Please try again." });
    } finally {
      processingRef.current = false;
      setScannerState("stopped");
    }
  }, []);

  const startScanner = useCallback(async () => {
    await stopScanner();
    setResult(null);
    setManualOpen(false);
    setCameraError("");
    setScannerState("starting");
    processingRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 }
        },
        async (decodedText: string) => {
          if (processingRef.current) return;
          processingRef.current = true;
          await stopScanner();
          await submitCode(decodedText);
        },
        () => undefined
      );

      if (mountedRef.current) setScannerState("scanning");
    } catch {
      if (!mountedRef.current) return;
      setCameraError("Camera permission failed or no camera was found. You can enter the pass code manually.");
      setManualOpen(true);
      setScannerState("stopped");
    }
  }, [stopScanner, submitCode]);

  useEffect(() => {
    mountedRef.current = true;
    void startScanner();
    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, [startScanner, stopScanner]);

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processingRef.current) return;
    processingRef.current = true;
    await stopScanner();
    await submitCode(manualCode);
  }

  return (
    <div className="admin-scanner-grid">
      <section className="scanner-card" aria-live="polite">
        <div className="scanner-status">
          <span className={`scanner-dot ${scannerState}`}></span>
          <strong>{scannerState === "scanning" ? "Camera active" : scannerState === "processing" ? "Verifying pass" : "Ready"}</strong>
        </div>
        <div id={READER_ID} className="scanner-frame" />
        <p className="scanner-note">Camera access requires HTTPS on mobile. For local testing, use localhost or deploy the app.</p>
        <div className="scanner-actions">
          <button className="button primary" type="button" onClick={startScanner} disabled={scannerState === "starting" || scannerState === "scanning" || scannerState === "processing"}>
            {scannerState === "starting" ? "Starting camera..." : "Start Scanner"}
          </button>
          <button className="button secondary" type="button" onClick={() => { void stopScanner(); setManualOpen(true); }}>
            Enter code manually
          </button>
        </div>
        {cameraError ? <p className="form-message error">{cameraError}</p> : null}
      </section>

      <section className="scanner-result-stack">
        {manualOpen ? (
          <form className="manual-code-card" onSubmit={submitManual}>
            <label>
              Manual pass code or QR URL
              <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="INV-2026-005 or /verify/pass/INV-2026-005" autoComplete="off" />
            </label>
            <button className="button primary" type="submit" disabled={scannerState === "processing"}>
              {scannerState === "processing" ? "Checking..." : "Submit code"}
            </button>
          </form>
        ) : null}

        {result ? (
          <article className={`scan-result-card ${resultClass(result.status)}`}>
            <p className="eyebrow">{result.status.replaceAll("_", " ")}</p>
            <h2>{resultTitle(result.status)}</h2>
            <p>{result.message}</p>
            {result.delegate ? (
              <dl className="scan-delegate-details">
                <div><dt>Name</dt><dd>{result.delegate.name || "Not available"}</dd></div>
                <div><dt>Committee</dt><dd>{result.delegate.committee || "Not allotted"}</dd></div>
                <div><dt>Portfolio / Country</dt><dd>{result.delegate.portfolio || "Not allotted"}</dd></div>
                <div><dt>Email</dt><dd>{result.delegate.email || "Not available"}</dd></div>
                <div><dt>Pass ID</dt><dd>{result.delegate.publicId || result.delegate.id || "Not available"}</dd></div>
                {result.checkedInAt ? <div><dt>Checked in</dt><dd>{formatDate(result.checkedInAt)}</dd></div> : null}
              </dl>
            ) : null}
            <button className="button primary" type="button" onClick={startScanner}>Scan another</button>
          </article>
        ) : (
          <article className="scan-result-card idle">
            <p className="eyebrow">NEXT DELEGATE</p>
            <h2>Point the camera at an allocation QR.</h2>
            <p>The server verifies the pass from the database, then records the check-in timestamp.</p>
          </article>
        )}
      </section>
    </div>
  );
}
