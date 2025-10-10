// apps/web/app/dashboard/meetings/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../../lib/auth";
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

export default async function MeetingsPage() {
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

  const upcomingTasks = tasks
    .filter((t) => t.dueDate)
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
    );

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const overdueTasks = upcomingTasks.filter(
    (t) => new Date(t.dueDate!) < today
  );
  
  const todayTasks = upcomingTasks.filter((t) => {
    const dueDate = new Date(t.dueDate!);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  });
  
  const futureTasks = upcomingTasks.filter(
    (t) => new Date(t.dueDate!) > today
  );

  return (
    <main className="p-6">
      <Header user={session.user} />

      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {overdueTasks.length > 0 && (
          <DashboardCard
            title="🚨 Overdue"
            className="border-l-4 border-red-600"
          >
            <TaskList tasks={overdueTasks} showAll />
          </DashboardCard>
        )}

        {todayTasks.length > 0 && (
          <DashboardCard
            title="📅 Due Today"
            className="border-l-4 border-orange-500"
          >
            <TaskList tasks={todayTasks} showAll />
          </DashboardCard>
        )}
      </div>

      <div className="mt-6">
        <DashboardCard
          title="📅 Upcoming Deadlines"
          className="border-l-4 border-blue-500"
        >
          <TaskList tasks={futureTasks} showAll />
        </DashboardCard>
      </div>
    </main>
  );
}