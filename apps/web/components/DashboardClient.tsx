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

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
        <span className="ml-3 text-white text-lg">Fetching your emails...</span>
      </div>
    );
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="p-6 bg-red-900 border border-red-700 rounded-xl text-red-200 max-w-sm text-center">
          <h2 className="text-lg font-semibold mb-2">Failed to Load Emails</h2>
          <p className="text-sm mb-4">
            Something went wrong while fetching your data.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white transition"
          >
            Retry
          </button>
        </div>
      </div>
    );

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
