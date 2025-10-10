// app/dashboard/layout.tsx

import { Sidebar } from "../../components/SideBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Static Sidebar */}
      <Sidebar />

      {/* Scrollable Main Content */}
      <div className="flex-1 overflow-y-auto bg-zinc-900">
        {children}
      </div>
    </div>
  );
}
