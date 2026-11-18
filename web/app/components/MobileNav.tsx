"use client";
// Mobile bottom nav (purple app reference) — real routes only, shown per
// role, active page highlighted. Rendered by layout.tsx on small screens.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";

function ChatIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4V5z" /></svg>;
}
function PatientsIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0v1H5v-1z" /></svg>;
}
function VisitIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}
function DashboardIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16v16H4z" /><path d="M8 16v-5m4 5V8m4 8v-3" /></svg>;
}
function TestsIcon() {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" /></svg>;
}

export default function MobileNav() {
  const { user } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = [
    { href: "/chat", label: "Chat", icon: <ChatIcon /> },
    { href: "/patients", label: "Patients", icon: <PatientsIcon /> },
    { href: "/visit", label: "Visit", icon: <VisitIcon /> },
    isAdmin
      ? { href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> }
      : { href: "/tests", label: "Tests", icon: <TestsIcon /> },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#070b08]/95 backdrop-blur border-t border-line">
      <div className="grid grid-cols-4 text-center text-xs font-semibold">
        {items.map((i) => {
          const active = pathname === i.href;
          return (
            <Link
              key={i.href}
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`py-3 flex flex-col items-center gap-1 ${active ? "text-grape" : "text-ink/70"}`}
            >
              {i.icon}
              {i.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
