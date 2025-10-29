import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { redirect } from "next/navigation";
import { TaskClient } from "../../../components/TaskClient";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  return (
    <main className="p-6">
      <TaskClient userId={session.user.id} />
    </main>
  );
}
