import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { Header } from "../../../components/Header";
import { TaskClient } from "../../../components/TaskClient";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  return (
    <main className="p-6">
      <Header user={session.user} />
      <TaskClient userId={session.user.id} />
    </main>
  );
}
