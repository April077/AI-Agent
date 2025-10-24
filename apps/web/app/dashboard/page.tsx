import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/auth";
import { redirect } from "next/navigation";
import { Header } from "../../components/Header";
import { DashboardClient } from "../../components/DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const user = session.user;

  return (
    <main className="p-6">
      <Header user={user} />
      <DashboardClient userId={session.user.id} userName={session.user.name} />
    </main>
  );
}
