"use client";

import { useState } from "react";
import { Home, Calendar, ListTodo, ArrowBigRight, Menu, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Overlay when sidebar is open */}
      <div
        className={`fixed inset-0 bg-black/40 z-20 lg:hidden transition-opacity ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-30 h-screen bg-slate-950 shadow-sm p-4 flex flex-col transition-transform duration-300
          ${open ? "translate-x-0 pt-18" : "-translate-x-full"} lg:translate-x-0 lg:relative lg:w-64 w-64`}
      >
        {/* Logo / Title */}
        <h2 className="text-xl font-semibold mb-6 text-white">Mail Buddy</h2>

        {/* Links */}
        <nav className="flex flex-col gap-2 flex-grow">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)} // auto close sidebar on mobile link click
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
          className="flex items-center cursor-pointer justify-between w-full px-4 py-2 rounded-xl text-white bg-gray-700 mt-auto"
        >
          Logout
          <ArrowBigRight size={20} />
        </button>
      </aside>

      {/* Hamburger button */}
      <button
        className="fixed top-4 left-4 z-40 lg:hidden text-white bg-gray-800 p-2 rounded-md"
        onClick={() => setOpen(!open)}
      >
        <Menu size={24} />
      </button>
    </>
  );
}
