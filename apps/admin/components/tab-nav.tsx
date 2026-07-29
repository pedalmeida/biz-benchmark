"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

type Tab = { label: string; href: string };

export function TabNav({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              "px-4 py-2 text-sm border-b-2 -mb-px transition-colors",
              isActive
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent hover:text-white"
            )}
            style={{ color: isActive ? undefined : "var(--ink-3)" }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
