"use client";

import { signOut } from "@/app/actions/auth";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut()}
      className="mt-8 h-12 rounded-full border border-gray-300 px-8 font-semibold text-foreground transition-all duration-200 hover:border-mint hover:text-mint active:scale-[0.97]"
      style={{ fontFamily: "var(--font-poppins), system-ui, sans-serif" }}
    >
      Sign Out
    </button>
  );
}
