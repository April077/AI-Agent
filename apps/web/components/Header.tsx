"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import Image from "next/image";
import { signOut } from "next-auth/react";

interface User {
  name?: string | null;
  image?: string | null;
}

export function Header({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex items-center text-white bg-zinc-900 justify-between p-4   backdrop-blur">
      {/* Search Input */}
      <div className="flex items-center gap-3">
        <Search size={20} />
        <input
          type="text"
          placeholder="Search tasks, meetings, or emails..."
          className="outline-none text-sm "
        />
      </div>

      {/* Profile Dropdown */}
      <div className="relative " ref={menuRef}>
        <button
          className="flex items-center gap-2 focus:outline-none"
          onClick={() => setOpen(!open)}
        >
          {user?.image && (
            <Image
              src={user.image}
              alt="Profile"
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="text-sm text-gray-400">{user?.name}</span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-lg z-50">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
