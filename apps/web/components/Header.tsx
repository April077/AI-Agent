// components/Header.tsx
"use client";

import { useState, useEffect } from "react";
import { RefreshButton } from "./Refresh";

export function Header({ user }: { user: any }) {
  const [mounted, setMounted] = useState(false);

  // Wait for client-side hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-2xl font-bold text-gray-900">
          Email Dashboard
        </h1>
        
        {mounted && ( // Only render search after hydration
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search emails..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {user?.name || user?.email}
        </span>
        <RefreshButton userId={user.id} refreshToken={user.refreshToken} />
      </div>
    </header>
  );
}