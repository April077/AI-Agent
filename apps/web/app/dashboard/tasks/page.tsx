// app/tasks/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { Header } from "../../../components/Header";
import { DashboardCard } from "../../../components/DashboardCard";
import { TaskList } from "../../../components/TaskList";

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

export default async function TasksPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const tasksResponse = await fetch(
    `http://localhost:4000/tasks/${session.user.id}`,
    { cache: "no-store" }
  );
  const { tasks }: { tasks: Task[]; stats: TaskStats } =
    await tasksResponse.json();

  const actionRequiredTasks = tasks.filter((t) => t.action);

  return (
    <main className="p-6">
      <Header user={session.user} />

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <DashboardCard
          title="⚡ Action Required"
          className="border-l-4 border-yellow-500"
        >
          <TaskList tasks={actionRequiredTasks} showAll />
        </DashboardCard>

        <DashboardCard
          title="🔴 High Priority Tasks"
          className="border-l-4 border-red-500"
        >
          <TaskList
            tasks={tasks.filter((t) => t.priority === "high")}
            showAll
          />
        </DashboardCard>
      </div>

      <div className="mt-6">
        <DashboardCard title="📋 All Tasks">
          <TaskList tasks={tasks} showAll />
        </DashboardCard>
      </div>
    </main>
  );
}