import Link from "next/link";
import { redirect } from "next/navigation";
import { assertAdmin } from "../../../lib/admin";
import { AdminQrScanner } from "./ScannerClient";

export const dynamic = "force-dynamic";

export default function AdminCheckInPage() {
  try {
    assertAdmin();
  } catch {
    redirect("/mun-ops");
  }

  return (
    <main className="admin-checkin-page">
      <section className="checkin-shell">
        <div className="checkin-top">
          <div>
            <p className="eyebrow">ADMIN QR CHECK-IN</p>
            <h1>Scan Delegate Pass</h1>
            <p>Use the phone camera to scan allocation QR codes and mark delegates checked in at the venue.</p>
          </div>
          <Link className="button secondary" href="/mun-ops">Back to Admin</Link>
        </div>
        <AdminQrScanner />
      </section>
    </main>
  );
}
