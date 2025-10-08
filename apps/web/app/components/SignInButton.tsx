"use client";

import { signIn, signOut } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";

interface Props {
  signedIn: boolean;
}

export default function SignInButton({ signedIn }: Props) {
  return signedIn ? (
    <button
      onClick={() => signOut()}
      className="px-6 py-2 bg-yellow-300 text-purple-800 rounded-lg font-semibold hover:bg-yellow-400 transition"
    >
      Sign Out
    </button>
  ) : (
    <button
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      className="flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-800 rounded-xl font-semibold hover:bg-gray-100 transition border border-gray-300"
    >
      <FcGoogle className="w-6 h-6" />
      Sign in with Google
    </button>
  );
}
