import { Email } from "@/packages/db/src";

export interface EmailStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  withActions: number;
  withDueDates: number;
}

interface EmailResponse {
  emails: Email[];
  stats: EmailStats;
}

interface SyncResponse {
  success: boolean;
  totalFetched: number;
  processed: number;
  skipped: number;
  processedEmails: Array<{
    id: string;
    subject: string;
    priority: string;
  }>;
}

// 📨 FETCH EMAILS
export async function fetchEmails(userId: string): Promise<EmailResponse> {
  console.log("[fetchEmails] Called with userId:", userId);

  try {
    const response = await fetch(`http://localhost:4000/emails/${userId}`, {
      cache: "no-store",
    });

    console.log("[fetchEmails] Response status:", response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[fetchEmails] Success — emails fetched:", data.emails?.length || 0);
    return data;
  } catch (error) {
    console.error("[fetchEmails] Error:", error);
    return {
      emails: [],
      stats: {
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        withActions: 0,
        withDueDates: 0,
      },
    };
  }
}

// 🔄 SYNC EMAILS
export async function syncEmails(
  refreshToken: string,
  userId: string
): Promise<SyncResponse> {
  console.log("[syncEmails] Starting sync for user:", userId);
  console.log("[syncEmails] Using refreshToken (first 10 chars):", refreshToken?.slice(0, 10));

  try {
    const response = await fetch("http://localhost:4000/sync-emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken,
        userId,
      }),
    });

    console.log("[syncEmails] Response status:", response.status);

    // Attempt to parse JSON safely
    let data: any = {};
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error("[syncEmails] Failed to parse response JSON:", parseErr);
      throw new Error("INVALID_JSON_RESPONSE");
    }

    console.log("[syncEmails] Response data:", data);

    if (!response.ok) {
      if (data.code === "TOKEN_EXPIRED" || data.error === "invalid_grant") {
        console.warn("[syncEmails] Token expired detected");
        throw new Error("TOKEN_EXPIRED");
      }

      console.error("[syncEmails] Sync failed with response:", data);
      return {
        success: false,
        totalFetched: 0,
        processed: 0,
        skipped: 0,
        processedEmails: [],
      };
    }

    console.log("[syncEmails] ✅ Sync successful:", data);
    return data;
  } catch (error: any) {
    if (error.message === "TOKEN_EXPIRED") {
      console.warn("[syncEmails] ❌ Token expired — rethrowing to component");
      throw error;
    }

    console.error("[syncEmails] Unexpected error:", error);
    return {
      success: false,
      totalFetched: 0,
      processed: 0,
      skipped: 0,
      processedEmails: [],
    };
  }
}

// 🗑️ DELETE EMAIL
export async function deleteEmail(emailId: string): Promise<boolean> {
  console.log("[deleteEmail] Attempting to delete:", emailId);
  try {
    const response = await fetch(`http://localhost:4000/emails/${emailId}`, {
      method: "DELETE",
    });

    console.log("[deleteEmail] Response:", response.status);

    if (!response.ok) {
      console.error("[deleteEmail] Failed to delete email");
      return false;
    }

    console.log("[deleteEmail] ✅ Email deleted successfully");
    return true;
  } catch (error) {
    console.error("[deleteEmail] Error:", error);
    return false;
  }
}

// 🟡 UPDATE PRIORITY
export async function updateEmailPriority(
  emailId: string,
  priority: "high" | "medium" | "low"
): Promise<boolean> {
  console.log("[updateEmailPriority] Updating", emailId, "to", priority);
  try {
    const response = await fetch(`http://localhost:4000/emails/${emailId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ priority }),
    });

    console.log("[updateEmailPriority] Response:", response.status);

    if (!response.ok) {
      console.error("[updateEmailPriority] Failed to update email priority");
      return false;
    }

    console.log("[updateEmailPriority] ✅ Priority updated successfully");
    return true;
  } catch (error) {
    console.error("[updateEmailPriority] Error:", error);
    return false;
  }
}
