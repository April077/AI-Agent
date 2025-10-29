import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { redirect } from "next/navigation";
import { DashboardClient } from "../../components/DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const user = session.user;

  return (
    <main className="p-6">
      <DashboardClient userId={session.user.id} userName={session.user.name} />
    </main>
  );
}
