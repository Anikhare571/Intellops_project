"use client";
/**
 * Single navigation for the whole application.
 * Views are grouped by purpose; the active view lives in the URL (?view=).
 */
import { useEffect, useState } from "react";
import {
  Activity, BadgeCheck, Calculator, ClipboardCheck, ChevronDown, Database, Gauge, History, Layers, LayoutDashboard,
  MessageSquare, Network, Settings, ShieldAlert, Table2, TrendingUp, Upload, Workflow,
  type LucideIcon,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type View =
  | "overview" | "tickets" | "automation" | "clusters" | "sla" | "anomalies" | "roi"
  | "copilot" | "review" | "evaluation" | "health" | "architecture" | "activity" | "settings";

interface NavItem { view: View; label: string; icon: LucideIcon }

export const NAV: { section: string; items: NavItem[] }[] = [
  { section: "Analysis", items: [
    { view: "overview", label: "Overview", icon: LayoutDashboard },
    { view: "tickets", label: "Tickets", icon: Table2 },
    { view: "automation", label: "Automation Opportunities", icon: Workflow },
    { view: "clusters", label: "Ticket Themes", icon: Network },
    { view: "sla", label: "SLA & Forecast", icon: TrendingUp },
    { view: "anomalies", label: "Anomalies", icon: ShieldAlert },
    { view: "roi", label: "ROI Calculator", icon: Calculator },
  ]},
  { section: "Intelligence", items: [
    { view: "copilot", label: "Copilot", icon: MessageSquare },
    { view: "review", label: "Review Queue", icon: ClipboardCheck },
    { view: "evaluation", label: "Model Evaluation", icon: BadgeCheck },
    { view: "health", label: "Model Health", icon: Gauge },
  ]},
  { section: "Platform", items: [
    { view: "architecture", label: "Architecture", icon: Layers },
  ]},
  { section: "Administration", items: [
    { view: "activity", label: "Activity Log", icon: History },
    { view: "settings", label: "Settings", icon: Settings },
  ]},
];

export const NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

interface Upload { id: number; filename: string; total_tickets: number; status: string; created_at: string }
interface Health { status: "healthy" | "degraded" | "unhealthy"; checks: Record<string, string> }

interface Props {
  view: View;
  onViewChange: (view: View) => void;
  uploads: Upload[];
  selectedUploadId?: number;
  onDatasetChange: (uploadId: number) => void;
  user?: { username: string; team_id: string; role?: string } | null;
}

export default function AppSidebar({ view, onViewChange, uploads, selectedUploadId, onDatasetChange, user }: Props) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const selected = uploads.find((u) => u.id === selectedUploadId);

  useEffect(() => {
    fetch(`${API}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth(null));
  }, []);

  const statusTone = !health ? "bg-red-500" : health.status === "healthy" ? "bg-emerald-500" : health.status === "degraded" ? "bg-amber-500" : "bg-red-500";
  const statusText = !health
    ? "Backend unreachable"
    : health.status === "healthy"
    ? "All services healthy"
    : Object.entries(health.checks).filter(([, v]) => v !== "ok").map(([k, v]) => `${k.replace("_", " ")}: ${v}`).join(" · ");

  return (
    <aside className="w-60 shrink-0 h-screen flex flex-col bg-slate-900 text-slate-300 border-r border-slate-800">
      <div className="px-5 pt-5 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-tight">IntelliOps</div>
            <div className="text-[11px] text-slate-500 leading-tight">ITSM analytics</div>
          </div>
        </div>
      </div>

      {/* Dataset */}
      <div className="px-3 pt-3 relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full text-left rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 hover:border-slate-600"
        >
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><Database className="w-3 h-3" /> Dataset</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
          <div className="text-[13px] text-slate-100 truncate mt-0.5">{selected?.filename ?? "No dataset"}</div>
          {selected && (
            <div className="text-[11px] text-slate-500 mt-0.5">
              {selected.total_tickets?.toLocaleString()} tickets · {new Date(selected.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          )}
        </button>
        {open && (
          <div className="absolute left-3 right-3 mt-1 z-50 max-h-72 overflow-y-auto rounded-md border border-slate-700 bg-slate-800 shadow-lg">
            {uploads.map((u) => (
              <button
                key={u.id}
                onClick={() => { setOpen(false); onDatasetChange(u.id); }}
                className={`w-full text-left px-3 py-2 border-b border-slate-700/60 last:border-0 hover:bg-slate-700/50 ${u.id === selectedUploadId ? "bg-blue-600/15" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[12px] truncate ${u.id === selectedUploadId ? "text-blue-300" : "text-slate-200"}`}>{u.filename}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${u.status === "completed" ? "text-emerald-400" : u.status === "failed" ? "text-red-400" : "text-amber-400"}`}>
                    {u.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">#{u.id} · {u.total_tickets?.toLocaleString() ?? 0} tickets</div>
              </button>
            ))}
            <a href="/upload" className="flex items-center gap-2 px-3 py-2 text-[12px] text-blue-300 hover:bg-slate-700/50">
              <Upload className="w-3.5 h-3.5" /> Upload new dataset
            </a>
          </div>
        )}
      </div>

      <div className="px-3 pt-2">
        <a
          href="/upload"
          className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-medium py-2"
        >
          <Upload className="w-4 h-4" /> Upload dataset
        </a>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-slate-500">{group.section}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = view === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => onViewChange(item.view)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] ${
                    active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? "text-blue-400" : ""}`} strokeWidth={1.75} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-400" title={health ? JSON.stringify(health.checks) : ""}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusTone}`} />
          <span className="truncate">{statusText}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[12px] text-slate-200 truncate">{user?.username ?? "—"}</div>
            <div className="text-[11px] text-slate-500 truncate">{user ? `${user.team_id}${user.role ? " · " + user.role : ""}` : ""}</div>
          </div>
          <button
            onClick={() => { localStorage.removeItem("token"); window.location.href = "/login"; }}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
