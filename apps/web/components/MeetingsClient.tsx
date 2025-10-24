"use client"
import { useQuery } from "@tanstack/react-query";
import { fetchEmails } from "../lib/email";
import { DashboardCard } from "./DashboardCard";
import { TaskList } from "./TaskList";

export function MeetingsClient({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["emails", userId],
    queryFn: () => fetchEmails(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching emails</div>;

  const emails = data?.emails || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const withDueDates = emails
    .filter((e) => !!e.dueDate)
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime()
    );

  const overdue = withDueDates.filter(
    (e) => e.dueDate && new Date(e.dueDate).getTime() < today.getTime()
  );

  const todayMeetings = withDueDates.filter((e) => {
    if (!e.dueDate) return false;
    const dueDate = new Date(e.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
  });

  const upcoming = withDueDates.filter(
    (e) => e.dueDate && new Date(e.dueDate).getTime() > today.getTime()
  );

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        {overdue.length > 0 && (
          <DashboardCard title="🚨 Overdue Meetings">
            <TaskList tasks={overdue} showAll />
          </DashboardCard>
        )}

        {todayMeetings.length > 0 && (
          <DashboardCard title="📅 Meetings Today">
            <TaskList tasks={todayMeetings} showAll />
          </DashboardCard>
        )}
      </div>

      <div className="mt-6">
        <DashboardCard title="📆 Upcoming Meetings">
          <TaskList tasks={upcoming} showAll />
        </DashboardCard>
      </div>
    </>
  );
}
