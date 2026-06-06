"use client";

import { useState } from "react";

interface DynamicUpiQrProps {
  amount: number | string;
}

export function DynamicUpiQr({ amount }: DynamicUpiQrProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const numAmount = Number(amount);

  // Requirement 5: Validate that the amount is a valid positive number before showing the QR.
  if (isNaN(numAmount) || numAmount <= 0) {
    return (
      <div style={{ color: "red", padding: "10px", textAlign: "center", fontWeight: "bold" }}>
        ⚠️ Invalid payment amount: ₹{amount}
      </div>
    );
  }

  const upiUrl = `upi://pay?pa=Q002222189@ybl&pn=PhonePeMerchant&mc=0000&mode=02&purpose=00&cu=INR&am=${numAmount.toFixed(2)}`;
  const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(upiUrl)}&size=300`;

  const copyUpiLink = async () => {
    try {
      await navigator.clipboard.writeText(upiUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link", err);
    }
  };

  const downloadQr = async () => {
    setDownloading(true);
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UPI_QR_Invictus_${numAmount.toFixed(2)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download QR", error);
      // Fallback: open in new tab
      window.open(qrImageUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
      <img
        src={qrImageUrl}
        alt={`UPI QR for ₹${numAmount.toFixed(2)}`}
        style={{
          maxWidth: "220px",
          width: "100%",
          borderRadius: "12px",
          border: "1px solid rgba(0,0,0,0.05)",
          padding: "10px",
          background: "white",
          marginBottom: "15px"
        }}
      />
      <div style={{ fontSize: "1.1em", fontWeight: "bold", color: "var(--purple)", marginBottom: "15px" }}>
        Pay ₹{numAmount.toFixed(2)}
      </div>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          className="button secondary"
          style={{ padding: "8px 16px", fontSize: "0.9em" }}
          onClick={copyUpiLink}
        >
          {copied ? "✓ Copied!" : "Copy UPI Link"}
        </button>
        <button
          type="button"
          className="button secondary"
          style={{ padding: "8px 16px", fontSize: "0.9em" }}
          onClick={downloadQr}
          disabled={downloading}
        >
          {downloading ? "Downloading..." : "Download QR"}
        </button>
      </div>
    </div>
  );
}
