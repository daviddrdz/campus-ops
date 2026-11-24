"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-items";

export function StaffNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="mx-auto max-w-3xl px-1">
      <ul className="flex overflow-x-auto">
        {items.map(({ href, label }) => {
          const isCurrent =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-[3px] px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isCurrent
                    ? "border-signal text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
