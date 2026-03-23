"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  FileText, Mail, Search, Briefcase, Zap, Inbox,
  MessageSquare, Users, BarChart3, Settings, LayoutDashboard, Upload,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Resume", icon: Upload },
  { href: "/resume", label: "Resumes", icon: FileText },
  { href: "/cover-letter", label: "Cover Letters", icon: Mail },
  { href: "/resume/scanner", label: "Resume Scanner", icon: Search },
  { href: "/jobs", label: "Job Board", icon: Briefcase },
  { href: "/auto-apply", label: "Auto Apply", icon: Zap },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/interview", label: "Interview Prep", icon: MessageSquare },
  { href: "/networking", label: "Networking", icon: Users },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          iAutoApply
        </span>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
