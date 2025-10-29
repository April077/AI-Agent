"use client";

import { Home, Calendar, ListTodo, ArrowBigRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/dashboard/meetings", label: "Meetings", icon: Calendar },
  { href: "/dashboard/tasks", label: "Tasks", icon: ListTodo },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen bg-slate-950 shadow-sm p-4 flex flex-col">
      <h2 className="text-xl font-semibold mb-6 text-white">Mail Buddy</h2>

      <nav className="flex flex-col gap-2 flex-grow">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 p-2 rounded-xl transition ${
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

      {/* Logout Button */}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex items-center justify-between w-full px-4 py-2 rounded-xl text-white bg-gray-700 transition"
      >
        <span>Logout</span>
        <ArrowBigRight size={20} />
      </button>
    </aside>
  );
}
