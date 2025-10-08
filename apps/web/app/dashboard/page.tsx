import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "../components/SideBar";
import { Header } from "../components/Header";
import { DashboardCard } from "../components/DashboardCard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  console.log("Session:", session);

  if (!session) {
    redirect("/"); // user not logged in
  }

  // safe to fetch now
  await fetch("http://localhost:4000/test-gmail", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.user.refreshToken , userId: session.user.id }),
  });

  
  const user = session.user;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header user={user} />
        <main className="p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DashboardCard title="AI Summary">
            <p>Good evening, {user.name} 👋 Here’s what I found today:</p>
            <ul className="text-sm text-gray-600 mt-2">
              <li>• 5 new emails summarized</li>
              <li>• 2 meetings scheduled for tomorrow</li>
              <li>• 3 tasks pending</li>
            </ul>
          </DashboardCard>

          <DashboardCard title="Recent Emails">
            <p>No new emails yet.</p>
          </DashboardCard>

          <DashboardCard title="To-Do List">
            <p>AI-generated tasks will appear here.</p>
          </DashboardCard>
        </main>
      </div>
    </div>
  );
}
