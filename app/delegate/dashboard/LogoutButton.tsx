"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/delegate/session", { method: "DELETE" });
    } finally {
      router.push("/delegate/login");
      router.refresh();
    }
  }

  return (
    <button className="button secondary" type="button" onClick={logout} disabled={isLoggingOut}>
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}

