import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { redirect } from "next/navigation";
import { Header } from "../../components/Header";
import { AISummary } from "../../components/AiSummary";
import { StatsGrid } from "../../components/StatsGrid";

interface Email {
  id: string;
  subject: string;
  summary: string | null;
  priority: string | null;
  action: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface EmailStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  withActions: number;
  withDueDates: number;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  try {
    // Sync emails in background
    await fetch("http://localhost:4000/sync-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: session.user.refreshToken,
        userId: session.user.id,
      }),
    });
  } catch (error) {
    console.error("Failed to sync emails:", error);
    // Continue to show existing emails even if sync fails
  }

  // Fetch emails from database
  const emailsResponse = await fetch(
    `http://localhost:4000/emails/${session.user.id}`,
    { cache: "no-store" }
  );
  
  const { emails, stats }: { emails: Email[]; stats: EmailStats } =
    await emailsResponse.json();

  const user = session.user;

  return (
    <main className="p-6">
      <Header user={user} />
      
      {user.name && (
        <AISummary user={{ name: user.name }} stats={stats} emails={emails} />
      )}

      <StatsGrid stats={stats} emails={emails} />
    </main>
  );
}