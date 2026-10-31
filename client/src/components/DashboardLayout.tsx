import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, CalendarDays, FileText, LogOut, Menu, Terminal } from "lucide-react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Queue", path: "/", icon: FileText },
  { label: "Schedule", path: "/calendar", icon: CalendarDays },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  if (loading) return <div className="min-h-screen bg-slate-100 flex items-center justify-center font-mono text-xs text-slate-500">initializing session…</div>;
  if (!user) return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-7 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white"><Terminal size={17} /></div><div><p className="font-mono text-sm font-semibold text-slate-900">SIGNAL_CONSOLE</p><p className="font-mono text-[10px] uppercase tracking-wider text-slate-400">authenticated access required</p></div></div><p className="mt-6 text-sm leading-relaxed text-slate-600">Sign in to access the content queue and scheduler.</p><Button onClick={() => startLogin()} className="mt-6 h-9 w-full rounded-md bg-slate-900 text-sm text-white hover:bg-slate-800">Sign in</Button></div></div>;

  return <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[224px_1fr]">
    <aside className="hidden lg:flex lg:flex-col border-r border-slate-200 bg-slate-950 px-4 py-4 text-slate-300">
      <div className="flex items-center gap-3 border-b border-slate-800 px-2 pb-4"><div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white"><Terminal size={15} /></div><div><p className="font-mono text-sm font-semibold text-white">SIGNAL_CONSOLE</p><p className="font-mono text-[9px] uppercase tracking-wider text-slate-500">content operations</p></div></div>
      <div className="mt-6 px-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">Navigation</div>
      <nav className="mt-2 space-y-1">{navItems.map(item => { const Icon = item.icon; const active = location === item.path; return <button key={item.path} onClick={() => setLocation(item.path)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${active ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}`}><Icon size={15} /><span>{item.label}</span></button>; })}</nav>
      <div className="mt-auto rounded-md border border-slate-800 bg-slate-900 p-3"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Mode</span><Badge className="rounded-sm bg-emerald-900 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 hover:bg-emerald-900">SIMULATION</Badge></div><div className="mt-3 flex items-center gap-2 text-xs text-slate-300"><Activity size={13} className="text-emerald-400" /> approval gate enabled</div></div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-800 px-2 pt-4"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 font-mono text-xs text-slate-300">{(user.name || "U").slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs text-slate-300">{user.name || "User"}</p><p className="truncate font-mono text-[10px] text-slate-600">{user.email || "authenticated"}</p></div><button onClick={logout} aria-label="Sign out" className="text-slate-500 hover:text-slate-200"><LogOut size={14} /></button></div>
    </aside>
    <main className="min-w-0"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden"><div className="flex items-center gap-2"><Menu size={16} className="text-slate-500" /><span className="font-mono text-sm font-semibold">SIGNAL_CONSOLE</span></div><button onClick={logout} aria-label="Sign out" className="text-slate-500"><LogOut size={15} /></button></div><div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 lg:hidden">{navItems.map(item => <button key={item.path} onClick={() => setLocation(item.path)} className={`shrink-0 rounded px-3 py-1.5 font-mono text-[11px] ${location === item.path ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{item.label}</button>)}</div><div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</div></main>
  </div>;
}
