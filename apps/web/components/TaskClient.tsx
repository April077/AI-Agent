"use client"
import { useQuery } from "@tanstack/react-query";
import { fetchEmails } from "../lib/email";
import { DashboardCard } from "./DashboardCard";
import { TaskList } from "./TaskList";

export function TaskClient({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["emails", userId],
    queryFn: () => fetchEmails(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching emails</div>;

  const emails = data?.emails || [];
  const actionRequired = emails.filter((e) => e.action);
  const highPriority = emails.filter((e) => e.priority === "high");

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <DashboardCard title="⚡ Action Required">
          <TaskList tasks={actionRequired} showAll />
        </DashboardCard>

        <DashboardCard title="🔴 High Priority">
          <TaskList tasks={highPriority} showAll />
        </DashboardCard>
      </div>

      <div className="mt-6">
        <DashboardCard title="📋 All Emails">
          <TaskList tasks={emails} showAll />
        </DashboardCard>
      </div>
    </>
  );
}
