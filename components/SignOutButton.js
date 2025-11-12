"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300"
    >
      ออกจากระบบ
    </button>
  );
}
