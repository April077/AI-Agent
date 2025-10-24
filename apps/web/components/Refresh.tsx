// components/Refresh.tsx
"use client";

import { useState } from "react";
import { syncEmails } from "../lib/email";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export function RefreshButton({
  userId,
  refreshToken,
}: {
  userId: string;
  refreshToken: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await syncEmails(refreshToken, userId);

      if (result.success) {
        router.refresh(); // Refresh the page to show new emails
      } else {
        setError("Failed to sync emails");
      }
    } catch (err: any) {
      if (err.message === "TOKEN_EXPIRED") {
        // Show message and sign out
        if (
          confirm("Your Gmail connection has expired. Please sign in again.")
        ) {
          await signOut({ callbackUrl: "/" });
        }
      } else {
        setError("Sync failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? "Syncing..." : "Refresh Emails"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
