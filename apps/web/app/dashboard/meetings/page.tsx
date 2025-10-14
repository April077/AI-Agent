// apps/web/app/dashboard/meetings/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../../lib/auth";
import { Header } from "../../../components/Header";
import { DashboardCard } from "../../../components/DashboardCard";
import { TaskList } from "../../../components/TaskList";

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

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);

  // Redirect if not logged in
  if (!session) {
    redirect("/");
  }

  const userId = session.user.id;

  // Fetch all emails from your backend
  const response = await fetch(`http://localhost:4000/emails/${userId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Failed to fetch emails:", response.statusText);
    return (
      <main className="p-6">
        <Header user={session.user} />
        <p className="text-red-500 mt-4">Failed to load meeting data.</p>
      </main>
    );
  }

  const { emails, stats }: { emails: Email[]; stats: EmailStats } =
    await response.json();

  // Filter only those with a dueDate (potentially representing meetings/tasks)
  const withDueDates = emails.filter((e) => e.dueDate);

  // Sort by nearest due date first
  const sorted = withDueDates.sort(
    (a, b) =>
      new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Categorize meetings
  const overdue = sorted.filter(
    (e) => new Date(e.dueDate!) < today
  );

  const todayMeetings = sorted.filter((e) => {
    const dueDate = new Date(e.dueDate!);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  });

  const upcoming = sorted.filter(
    (e) => new Date(e.dueDate!) > today
  );

  return (
    <main className="p-6">
      <Header user={session.user} />

      {/* Overdue & Today's meetings */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {overdue.length > 0 && (
          <DashboardCard
            title="🚨 Overdue Meetings"
            className="border-l-4 border-red-600"
          >
            <TaskList tasks={overdue} showAll />
          </DashboardCard>
        )}

        {todayMeetings.length > 0 && (
          <DashboardCard
            title="📅 Meetings Today"
            className="border-l-4 border-orange-500"
          >
            <TaskList tasks={todayMeetings} showAll />
          </DashboardCard>
        )}
      </div>

      {/* Upcoming meetings */}
      <div className="mt-6">
        <DashboardCard
          title="📆 Upcoming Meetings"
          className="border-l-4 border-blue-500"
        >
          <TaskList tasks={upcoming} showAll />
        </DashboardCard>
      </div>
    </main>
  );
}
