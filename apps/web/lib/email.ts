
interface Email {
  id: string;
  userId: string;
  emailId: string;
  from: string;
  snippet: string;
  receivedAt: Date;
  processed: boolean;
  subject: string;
  summary: string | null;
  priority: string | null;
  action: string | null;
  dueDate: Date | null;
  dueTime: string | null;
  createdAt: Date;
}

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

export async function fetchEmails(userId: string): Promise<EmailResponse> {
  console.log("[fetchEmails] Called with userId:", userId);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/emails/${userId}`,
      {
        cache: "no-store",
      }
    );

    console.log("[fetchEmails] Response status:", response.status);

    if (!response.ok) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(
      "[fetchEmails] Success — emails fetched:",
      data.emails?.length || 0
    );
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
