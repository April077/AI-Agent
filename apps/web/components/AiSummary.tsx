interface AISummaryProps {
  user: { name: string };
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
    withActions: number;
    withDueDates: number;
  };
  tasks: Array<{
    priority: string | null;
    dueDate: string | null;
    action: string | null;
    subject: string;
  }>;
}

export function AISummary({ user, stats, tasks }: AISummaryProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getInsights = () => {
    const insights = [];

    if (stats.high > 0) {
      insights.push({
        icon: "🚨",
        text: `${stats.high} high-priority ${stats.high === 1 ? 'email needs' : 'emails need'} immediate attention`,
        color: "text-red-600"
      });
    }

    if (stats.withDueDates > 0) {
      const upcomingDeadlines = tasks.filter(t => {
        if (!t.dueDate) return false;
        const daysUntil = Math.ceil(
          (new Date(t.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysUntil <= 3 && daysUntil >= 0;
      }).length;

      if (upcomingDeadlines > 0) {
        insights.push({
          icon: "⏰",
          text: `${upcomingDeadlines} ${upcomingDeadlines === 1 ? 'deadline is' : 'deadlines are'} coming up in the next 3 days`,
          color: "text-orange-600"
        });
      }
    }

    if (stats.withActions > 0) {
      insights.push({
        icon: "✅",
        text: `${stats.withActions} ${stats.withActions === 1 ? 'email requires' : 'emails require'} your action`,
        color: "text-blue-600"
      });
    }

    if (stats.total === 0) {
      insights.push({
        icon: "🎉",
        text: "All caught up! No new emails to process.",
        color: "text-green-600"
      });
    }

    return insights;
  };

  const insights = getInsights();

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">
            {getGreeting()}, {user.name.split(' ')[0]}! 👋
          </h1>
          <p className="text-blue-100 mt-1">
            AI Agent analyzed {stats.total} {stats.total === 1 ? 'email' : 'emails'}
          </p>
        </div>
        <div className="hidden md:block">
          <div className="bg-white/20 backdrop-blur rounded-lg px-4 py-2">
            <div className="text-3xl font-bold">{stats.total}</div>
            <div className="text-xs text-blue-100">Total Tasks</div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
          <div className="text-2xl font-bold">{stats.high}</div>
          <div className="text-xs text-blue-100">High Priority</div>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
          <div className="text-2xl font-bold">{stats.medium}</div>
          <div className="text-xs text-blue-100">Medium Priority</div>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
          <div className="text-2xl font-bold">{stats.withActions}</div>
          <div className="text-xs text-blue-100">Need Action</div>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-lg p-3">
          <div className="text-2xl font-bold">{stats.withDueDates}</div>
          <div className="text-xs text-blue-100">With Deadlines</div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-blue-100 mb-3">🤖 AI Insights</h3>
        {insights.length > 0 ? (
          insights.map((insight, idx) => (
            <div 
              key={idx}
              className="bg-white/10 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-3"
            >
              <span className="text-2xl">{insight.icon}</span>
              <span className="text-sm">{insight.text}</span>
            </div>
          ))
        ) : (
          <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
            <span className="text-sm">Processing your emails...</span>
          </div>
        )}
      </div>
    </div>
  );
}