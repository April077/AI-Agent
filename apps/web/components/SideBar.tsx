"use client";

import { Home, Inbox, Calendar, ListTodo, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/emails", label: "Emails", icon: Inbox },
  { href: "/dashboard/meetings", label: "Meetings", icon: Calendar },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-slate-950  shadow-sm p-4 flex flex-col">
      <h2 className="text-xl font-semibold mb-6 text-white">AI Agent</h2>
      <nav className="flex flex-col  gap-2">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center  gap-3 p-2 rounded-xl transition ${
              pathname === href
                ? "bg-gray-700 text-white"
                : "text-white hover:bg-gray-600"
            }`}
          >
            <Icon size={20} />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
