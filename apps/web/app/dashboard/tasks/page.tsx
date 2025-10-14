// app/tasks/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { redirect } from "next/navigation";
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

export default async function TasksPage() {
  const session = await getServerSession(authOptions);

  // Redirect if not authenticated
  if (!session) {
    redirect("/");
  }

  const userId = session.user.id;

  // Fetch user emails (tasks)
  const response = await fetch(`http://localhost:4000/emails/${userId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Failed to fetch tasks:", response.statusText);
    return (
      <main className="p-6">
        <Header user={session.user} />
        <p className="text-red-500 mt-4">Failed to load tasks.</p>
      </main>
    );
  }

  const { emails, stats }: { emails: Email[]; stats: EmailStats } =
    await response.json();

  const actionRequired = emails.filter((e) => e.action);
  const highPriority = emails.filter((e) => e.priority === "high");

  return (
    <main className="p-6">
      <Header user={session.user} />

      {/* Action Required & High Priority */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <DashboardCard
          title="⚡ Action Required"
          className="border-l-4 border-yellow-500"
        >
          <TaskList tasks={actionRequired} showAll />
        </DashboardCard>

        <DashboardCard
          title="🔴 High Priority Emails"
          className="border-l-4 border-red-500"
        >
          <TaskList tasks={highPriority} showAll />
        </DashboardCard>
      </div>

      {/* All Tasks */}
      <div className="mt-6">
        <DashboardCard title="📋 All Emails">
          <TaskList tasks={emails} showAll />
        </DashboardCard>
      </div>
    </main>
  );
}
