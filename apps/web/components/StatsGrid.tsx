import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface Email {
  id: string;
  priority: string | null;
  action: string | null;
  dueDate: Date | null;
}

interface TaskStats {
  total: number;
  high: number;
  medium: number;
  low: number;
  withActions: number;
  withDueDates: number;
}

interface StatsGridProps {
  stats: TaskStats;
  emails: Email[];
}

export function StatsGrid({ stats, emails }: StatsGridProps) {
  console.log("StatsGrid stats:", stats);
  console.log("StatsGrid emails:", emails.filter((t) => t.dueDate));
  const upcomingDeadlines = emails.filter((t) => t.dueDate).length;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-6">
      <Link href="/emails">
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Emails</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <ArrowRight className="text-gray-400" />
          </div>
        </div>
      </Link>

      <Link href="/emails?priority=high">
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Priority</p>
              <p className="text-3xl font-bold text-red-600">{stats.high}</p>
            </div>
            <ArrowRight className="text-gray-400" />
          </div>
        </div>
      </Link>

      <Link href="/calendar">
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Deadlines</p>
              <p className="text-3xl font-bold text-purple-600">
                {upcomingDeadlines}
              </p>
            </div>
            <ArrowRight className="text-gray-400" />
          </div>
        </div>
      </Link>

      <Link href="/tasks">
        <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Action Required</p>
              <p className="text-3xl font-bold text-yellow-600">
                {stats.withActions}
              </p>
            </div>
            <ArrowRight className="text-gray-400" />
          </div>
        </div>
      </Link>
    </div>
  );
}