import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../../../lib/auth";
import { MeetingsClient } from "../../../components/MeetingsClient";

export default async function MeetingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  return (
    <main className="p-6">
      <MeetingsClient userId={session.user.id} />
    </main>
  );
}