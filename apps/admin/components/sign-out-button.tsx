"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="text-xs px-3 py-1 rounded border transition-colors"
      style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
    >
      Sign out
    </button>
  );
}
