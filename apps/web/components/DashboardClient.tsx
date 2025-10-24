"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchEmails } from "../lib/email";
import { AISummary } from "./AiSummary";
import { StatsGrid } from "./StatsGrid";

interface DashboardClientProps {
  userId: string;
  userName?: string | undefined | null;
}

export function DashboardClient({ userId, userName }: DashboardClientProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["emails", userId],
    queryFn: () => fetchEmails(userId),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error fetching emails</div>;

  const emails = data?.emails;
  const stats = data?.stats;

  return (
    <>
      {userName && stats && emails && (
        <>
          <AISummary user={{ name: userName }} stats={stats} emails={emails} />
          <StatsGrid stats={stats} emails={emails} />
        </>
      )}
    </>
  );
}
