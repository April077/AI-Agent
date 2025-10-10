import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { redirect } from "next/navigation";
import { Header } from "../../components/Header";
import { AISummary } from "../../components/AiSummary";
import { StatsGrid } from "../../components/StatsGrid";


interface Task {
  id: string;
  subject: string;
  summary: string | null;
  priority: string | null;
  action: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface TaskStats {
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

  // Sync emails in background
  await fetch("http://localhost:4000/test-gmail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: session.user.refreshToken,
      userId: session.user.id,
    }),
  });

  const tasksResponse = await fetch(
    `http://localhost:4000/tasks/${session.user.id}`,
    { cache: "no-store" }
  );
  const { tasks, stats }: { tasks: Task[]; stats: TaskStats } =
    await tasksResponse.json();

  const user = session.user;

  return (
    <main className="p-6">
      <Header user={user} />
      
      {user.name && (
        <AISummary user={{ name: user.name }} stats={stats} tasks={tasks} />
      )}

      <StatsGrid stats={stats} tasks={tasks} />
    </main>
  );
}