"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Home,
  CreditCard,
  TrendingUp,
  MessageSquare,
  LogOut,
  DollarSign,
  Sparkles,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/transacoes", label: "Transações", icon: DollarSign },
  { href: "/faturas", label: "Faturas", icon: CreditCard },
  { href: "/investimentos", label: "Investimentos", icon: TrendingUp },
  { href: "/insights", label: "Insights IA", icon: Sparkles },
];

interface SidebarProps {
  user: { name?: string | null; email?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center gap-2 px-4 py-5 border-b border-zinc-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
          <Home className="h-4 w-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Casa Finanças</p>
          <p className="text-xs text-zinc-400">Família Burigo</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-emerald-50 text-emerald-700"
                : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-2 py-4 border-t border-zinc-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
            {user.name?.charAt(0) ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-700 truncate">{user.name}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-500 hover:bg-red-50 transition-colors w-full"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
