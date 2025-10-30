interface Email {
  id: string;
  userId: string;
  emailId: string;
  subject: string;
  summary: string | null;
  priority: string | null;
  action: string | null;
  dueDate: Date | null;
  createdAt: Date;
  receivedAt: Date;
}

interface EmailListProps {
  tasks: Email[];
  limit?: number;
  showAll?: boolean;
}

export function TaskList({
  tasks,
  limit = 5,
  showAll = false,
}: EmailListProps) {
  const displayTasks = showAll ? tasks : tasks.slice(0, limit);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm">No tasks yet</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;

    const dueDate = typeof date === "string" ? new Date(date) : date;
    const now = new Date();

    // Reset time to compare just dates
    dueDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "🔴 Overdue";
    if (diffDays === 0) return "🟡 Today";
    if (diffDays === 1) return "🟢 Tomorrow";
    if (diffDays <= 7) return `📅 In ${diffDays} days`;

    return dueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-3">
      {displayTasks.map((task) => (
        <div
          key={task.id}
          className="border border-gray-200  rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
        >
          {/* Header */}
          {task.priority && (
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">
                {task.subject}
              </h4>
              <span
                className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(task.priority)}`}
              >
                {task.priority}
              </span>
            </div>
          )}

          {/* Summary */}
          {task.summary && (
            <p className="text-xs text-gray-600 mb-2 line-clamp-2">
              {task.summary}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {task.dueDate && (
                <span className="flex items-center gap-1">
                  {formatDate(task.dueDate)}
                </span>
              )}
              {task.action && (
                <span className="flex items-center gap-1">
                  ⚡ Action needed
                </span>
              )}
            </div>
            <time>
              {new Date(task.receivedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </time>
          </div>

          {/* Action */}
          {task.action && showAll && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-xs text-blue-600">💡 {task.action}</p>
            </div>
          )}
        </div>
      ))}

      {!showAll && tasks.length > limit && (
        <div className="text-center pt-2">
          <p className="text-xs text-gray-500">
            + {tasks.length - limit} more{" "}
            {tasks.length - limit === 1 ? "task" : "tasks"}
          </p>
        </div>
      )}
    </div>
  );
}
