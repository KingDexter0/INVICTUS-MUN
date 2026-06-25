"use client";
import { useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PreviewData {
  appUrl: { appUrl: string; isSet: boolean; isLocalhost: boolean; isProduction: boolean };
  smtp: { configured: boolean };
  totals: {
    individuals: { total: number; eligible: number; alreadySent: number; missingEmail: number; missingToken: number; missingAllotment: number };
    delegates: { total: number; eligible: number; alreadySent: number; missingEmail: number; missingToken: number; missingAllotment: number };
    totalEligible: number;
    totalAlreadySent: number;
  };
  samples: {
    individuals: Array<{ name: string; email: string; publicId: string; committee: string; dashboardUrl: string }>;
    delegates: Array<{ name: string; email: string; publicId: string; delegationName: string; committee: string; dashboardUrl: string }>;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmailCampaignPage() {
  const [preview, setPreview] = useState<PreviewData | null>(null);
   const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<"send" | "resend">("send");
  const [progress, setProgress] = useState<{ sent: number; failed: number; done: boolean; remaining: number } | null>(null);
  const abortRef = useRef(false);

  // Load preview
  async function loadPreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/emails/welcome-allotment/preview");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load preview.");
      setPreview(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function runSmtpTest() {
    setSmtpTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/email/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "SMTP verification/send failed.");
      setTestResult(data.message || "Test email sent successfully.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSmtpTesting(false);
    }
  }

  useEffect(() => { loadPreview(); }, []);

  // Batch send loop
  async function runSend(mode: "send" | "resend") {
    const endpoint = mode === "resend"
      ? "/api/admin/emails/welcome-allotment/resend-failed"
      : "/api/admin/emails/welcome-allotment/send";

    abortRef.current = false;
    setSending(true);
    setProgress({ sent: 0, failed: 0, done: false, remaining: preview?.totals.totalEligible || 0 });

    let totalSent = 0;
    let totalFailed = 0;

    while (!abortRef.current) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirm: true, batchSize: 25 })
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Sending failed.");
          break;
        }

        totalSent += data.sent || 0;
        totalFailed += data.failed || 0;

        setProgress({ sent: totalSent, failed: totalFailed, done: data.done, remaining: data.remaining || 0 });

        if (data.done) break;
        // Small pause between batches to avoid rate limiting
        await new Promise((r) => setTimeout(r, 800));
      } catch (err) {
        setError((err as Error).message);
        break;
      }
    }

    setSending(false);
    setConfirmOpen(false);
    // Refresh preview after send
    await loadPreview();
  }

  const appUrlOk = preview?.appUrl.isProduction;
  const smtpOk = preview?.smtp.configured;
  const canSend = appUrlOk && smtpOk && !sending;

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "26px", fontWeight: 700, marginBottom: "4px" }}>Welcome &amp; Allotment Email Campaign</h1>
      <p style={{ color: "#706b7e", marginBottom: "28px" }}>
        Send a one-time welcome + portfolio email to every eligible registered delegate.
        This must be triggered manually after deployment.
      </p>

      {/* ── Status Bar ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        <StatusPill label="APP_URL" ok={Boolean(appUrlOk)} value={preview?.appUrl.appUrl || "…"} />
        <StatusPill label="SMTP" ok={Boolean(smtpOk)} value={smtpOk ? "Configured" : "Not configured"} />
        {preview && (
          <>
            <StatPill label="Total Delegates" value={preview.totals.individuals.total + preview.totals.delegates.total} color="#3b82f6" />
            <StatPill label="Eligible" value={preview.totals.totalEligible} color="#6d43c8" />
            <StatPill label="Already sent" value={preview.totals.totalAlreadySent} color="#059669" />
          </>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", color: "#b91c1c" }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#b91c1c" }}>✕</button>
        </div>
      )}

      {/* ── Test Result ──────────────────────────────────────────────────── */}
      {testResult && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", color: "#166534" }}>
          <strong>Success:</strong> {testResult}
          <button onClick={() => setTestResult(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#166534" }}>✕</button>
        </div>
      )}

      {/* ── Warning for localhost ──────────────────────────────────────────── */}
      {preview?.appUrl.isLocalhost && (
        <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", color: "#c2410c" }}>
          <strong>⚠ Warning:</strong> APP_URL is set to a localhost address ({preview.appUrl.appUrl}).
          Email links will be broken. Set <code>APP_URL=https://your-domain.vercel.app</code> in Vercel Environment Variables and redeploy.
        </div>
      )}

      {/* ── Action Buttons ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
        <button
          onClick={loadPreview}
          disabled={loading}
          style={btnStyle("secondary")}
        >
          {loading ? "Loading…" : "↻ Refresh Preview"}
        </button>
        <button
          onClick={runSmtpTest}
          disabled={smtpTesting || sending}
          style={btnStyle("secondary")}
        >
          {smtpTesting ? "Testing SMTP..." : "🧪 Run SMTP Test Email"}
        </button>
        <button
          onClick={() => { setSendMode("send"); setConfirmOpen(true); }}
          disabled={!canSend || (preview?.totals.totalEligible === 0)}
          style={btnStyle("primary")}
        >
          ✉ Send Welcome &amp; Allotment Emails
        </button>
        <button
          onClick={() => { setSendMode("resend"); setConfirmOpen(true); }}
          disabled={!canSend}
          style={btnStyle("warning")}
        >
          ↺ Resend Failed Emails
        </button>
      </div>

      {/* ── Progress ──────────────────────────────────────────────────────── */}
      {progress && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
          <h3 style={{ margin: "0 0 12px", color: "#166534" }}>
            {progress.done ? "✅ Campaign Complete" : `📨 Sending… (${progress.remaining} remaining)`}
          </h3>
          <div style={{ display: "flex", gap: "20px" }}>
            <span style={{ color: "#166534" }}><strong>{progress.sent}</strong> Sent</span>
            <span style={{ color: "#b91c1c" }}><strong>{progress.failed}</strong> Failed</span>
            <span style={{ color: "#374151" }}><strong>{progress.remaining}</strong> Remaining</span>
          </div>
          {sending && (
            <button
              onClick={() => { abortRef.current = true; }}
              style={{ ...btnStyle("secondary"), marginTop: "12px", fontSize: "13px" }}
            >
              Stop Sending
            </button>
          )}
        </div>
      )}

      {/* ── Totals Grid ───────────────────────────────────────────────────── */}
      {preview && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
            <CategoryCard title="Individual Registrations" stats={preview.totals.individuals} />
            <CategoryCard title="Delegation Delegates" stats={preview.totals.delegates} />
          </div>

          {/* ── Sample Recipients ─────────────────────────────────────────── */}
          {(preview.samples.individuals.length > 0 || preview.samples.delegates.length > 0) && (
            <div style={{ background: "#fafafa", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: "15px", fontWeight: 700 }}>Sample Eligible Recipients</h3>
              {preview.samples.individuals.length > 0 && (
                <>
                  <p style={{ fontWeight: 600, fontSize: "13px", color: "#6d43c8", margin: "0 0 8px" }}>Individuals</p>
                  <SampleTable rows={preview.samples.individuals} />
                </>
              )}
              {preview.samples.delegates.length > 0 && (
                <>
                  <p style={{ fontWeight: 600, fontSize: "13px", color: "#6d43c8", margin: "14px 0 8px" }}>Delegation Delegates</p>
                  <SampleTable rows={preview.samples.delegates} />
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Confirm Modal ─────────────────────────────────────────────────── */}
      {confirmOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "32px", maxWidth: "480px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "20px" }}>
              {sendMode === "resend" ? "Resend Failed Emails?" : "Send Campaign Emails?"}
            </h2>
            <p style={{ color: "#374151", lineHeight: 1.7, marginBottom: "8px" }}>
              {sendMode === "resend"
                ? "This will retry all previously failed email sends. Only records without a successful send will be processed."
                : `This will send welcome and allotment emails to all ${preview?.totals.totalEligible} eligible registered participants.`}
            </p>
            <p style={{ color: "#b45309", background: "#fef9c3", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "20px" }}>
              ⚠ This should only be done <strong>once after deployment verification</strong>.
              Participants who have already received an email will be automatically skipped.
            </p>
            <p style={{ fontSize: "13px", color: "#374151", marginBottom: "20px" }}>
              <strong>APP_URL:</strong> {preview?.appUrl.appUrl}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmOpen(false)} style={btnStyle("secondary")}>Cancel</button>
              <button
                onClick={() => { setConfirmOpen(false); void runSend(sendMode); }}
                style={btnStyle("primary")}
              >
                Confirm &amp; Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusPill({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "999px", background: ok ? "#dcfce7" : "#fef2f2", border: `1px solid ${ok ? "#86efac" : "#fca5a5"}`, fontSize: "13px" }}>
      <span style={{ color: ok ? "#166534" : "#b91c1c", fontWeight: 700 }}>{label}</span>
      <span style={{ color: ok ? "#166534" : "#b91c1c", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", borderRadius: "999px", background: "#f5f3ff", border: "1px solid #ddd6fe", fontSize: "13px" }}>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
      <span style={{ color: "#374151" }}>{label}</span>
    </div>
  );
}

function CategoryCard({ title, stats }: { title: string; stats: { total: number; eligible: number; alreadySent: number; missingEmail: number; missingToken: number; missingAllotment: number } }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px" }}>
      <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#6d43c8" }}>{title}</h3>
      <table style={{ width: "100%", fontSize: "13px", borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["Total registered", stats.total],
            ["Eligible (will send)", stats.eligible, "#059669"],
            ["Already sent (skip)", stats.alreadySent, "#374151"],
            ["Missing email (skip)", stats.missingEmail, "#b91c1c"],
            ["Missing token (skip)", stats.missingToken, "#b45309"],
            ["Missing committee (skip)", stats.missingAllotment, "#b45309"]
          ].map(([label, value, color]) => (
            <tr key={String(label)}>
              <td style={{ padding: "3px 0", color: "#374151" }}>{label}</td>
              <td style={{ padding: "3px 0", textAlign: "right", fontWeight: 600, color: (color as string) || "#111" }}>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SampleTable({ rows }: { rows: Array<Record<string, string>> }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
            {["Name", "Email", "Committee", "Dashboard URL"].map((h) => (
              <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "#6b7280", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "6px 8px" }}>{row.name}</td>
              <td style={{ padding: "6px 8px", color: "#6d43c8" }}>{row.email}</td>
              <td style={{ padding: "6px 8px" }}>{row.committee || "–"}</td>
              <td style={{ padding: "6px 8px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <a href={row.dashboardUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#6d43c8", textDecoration: "none" }}>
                  {row.dashboardUrl?.includes("localhost") ? (
                    <span style={{ color: "#b91c1c" }}>⚠ {row.dashboardUrl}</span>
                  ) : row.dashboardUrl}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function btnStyle(variant: "primary" | "secondary" | "warning") {
  const base: React.CSSProperties = {
    padding: "10px 20px",
    borderRadius: "999px",
    fontWeight: 700,
    fontSize: "14px",
    cursor: "pointer",
    border: "none",
    transition: "opacity 0.15s"
  };
  if (variant === "primary") return { ...base, background: "#6d43c8", color: "#fff" };
  if (variant === "warning") return { ...base, background: "#f59e0b", color: "#fff" };
  return { ...base, background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" };
}
