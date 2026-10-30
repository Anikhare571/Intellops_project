"use client";
/**
 * Model lifecycle: drift for this dataset, retraining from analyst labels with
 * an evaluation gate, version history with rollback, and re-scoring.
 * Data: /api/models/*
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const pct = (v: number | null | undefined) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const f1 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(3));

async function call(path: string, method = "GET") {
  const r = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail || `${r.status} ${r.statusText}`);
  return body;
}

const DRIFT_STYLE: Record<string, string> = {
  stable: "bg-emerald-50 text-emerald-700 border-emerald-200",
  moderate: "bg-amber-50 text-amber-700 border-amber-200",
  significant: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-gray-50 text-gray-600 border-gray-200",
};

export default function ModelLifecycle({ uploadId, isAdmin, onRescored }: {
  uploadId: number; isAdmin: boolean; onRescored?: () => void;
}) {
  const [drift, setDrift] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [d, s, v] = await Promise.all([
      call(`/api/models/drift/${uploadId}`).catch(() => null),
      call(`/api/models/automation/retrain-status`).catch(() => null),
      call(`/api/models/automation/versions`).catch(() => ({ versions: [] })),
    ]);
    setDrift(d);
    setStatus(s);
    setVersions(v.versions);
    return s;
  }, [uploadId]);

  useEffect(() => { refresh(); }, [refresh]);

  // poll while a retraining run is in progress
  useEffect(() => {
    if (status?.state !== "running") return;
    const t = setInterval(() => refresh(), 4000);
    return () => clearInterval(t);
  }, [status?.state, refresh]);

  async function act(kind: string, fn: () => Promise<any>, done: string) {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(null);
    }
  }

  const running = status?.state === "running";

  return (
    <section className="bg-white border border-gray-200 rounded-lg">
      <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Model lifecycle</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Analyst labels from the Review Queue retrain the automation classifier. A new version is deployed only if it
            beats the active one on a frozen test set.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="btn-secondary" disabled={!!busy}
            onClick={() => act("rescore", () => call(`/api/models/rescore/${uploadId}`, "POST"),
              "Re-scoring this dataset with the active model. Refresh in a minute.").then(() => onRescored?.())}>
            {busy === "rescore" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Re-score dataset
          </button>
          {isAdmin && (
            <button className="btn-primary" disabled={!!busy || running}
              onClick={() => act("retrain", () => call(`/api/models/automation/retrain`, "POST"), "Retraining started.")}>
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {running ? "Retraining…" : "Retrain from labels"}
            </button>
          )}
        </div>
      </header>

      {message && <p className="px-4 pt-3 text-xs text-gray-700">{message}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 p-4">
        {/* Drift */}
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-gray-700">Drift on this dataset</h4>
            <span className={`text-[11px] px-1.5 py-0.5 rounded border ${DRIFT_STYLE[drift?.status ?? "unknown"]}`}>
              {drift?.status ?? "unknown"}
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1.5">{drift?.recommendation}</p>
          {drift?.findings?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-gray-700 list-disc pl-4">
              {drift.findings.map((f: any, i: number) => <li key={i}>{f.message}</li>)}
            </ul>
          )}
          {drift?.psi && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat label="Known vocabulary" value={pct(drift.known_vocabulary_share)} />
              <Stat label="Unsure tickets" value={`${pct(drift.low_confidence_share)} vs ${pct(drift.validation_low_confidence_share)}`} />
              <Stat label="Max PSI" value={Math.max(...(Object.values(drift.psi) as number[])).toFixed(2)} />
            </dl>
          )}
        </div>

        {/* Last retraining */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700">Last retraining</h4>
          {!status || status.state === "never_run" ? (
            <p className="text-xs text-gray-500 mt-1.5">No retraining run yet.</p>
          ) : status.state === "running" ? (
            <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running since {status.started_at}</p>
          ) : status.state === "failed" ? (
            <p className="text-xs text-red-600 mt-1.5">Failed: {status.error}</p>
          ) : (
            <div className="mt-1.5 text-xs space-y-2">
              <p className={status.promoted ? "text-emerald-700" : "text-amber-700"}>
                Version {status.version} {status.promoted ? "promoted" : "not promoted"}: {status.reason}
              </p>
              <p className="text-gray-500">
                {status.training_rows?.toLocaleString()} training rows, {status.analyst_labels} analyst labels
                ({status.analyst_gold} held out in the frozen test set). Finished {status.finished_at}.
              </p>
              <table className="w-full">
                <thead><tr className="text-gray-500 text-left"><th className="py-1 font-medium">Frozen test set</th><th className="py-1 font-medium text-right">Active model</th><th className="py-1 font-medium text-right">Candidate</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.keys(status.candidate || {}).map((part) => (
                    <tr key={part}>
                      <td className="py-1 text-gray-700">{part === "all" ? "All" : part === "base" ? "Base data" : "Analyst labels"} ({status.candidate[part].n})</td>
                      <td className="py-1 text-right tabular-nums">{f1(status.active_before?.[part]?.macro_f1)}</td>
                      <td className="py-1 text-right tabular-nums">{f1(status.candidate[part].macro_f1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-gray-400">Macro F1. Experiment tracked in MLflow{status.mlflow_run_id ? ` (run ${status.mlflow_run_id.slice(0, 8)})` : ""}.</p>
            </div>
          )}
        </div>
      </div>

      {/* Versions */}
      <div className="px-4 pb-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Versions</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 font-medium">Version</th><th className="py-1.5 font-medium">Status</th>
              <th className="py-1.5 font-medium text-right">Macro F1</th><th className="py-1.5 font-medium text-right">Accuracy</th>
              <th className="py-1.5 font-medium">Training data</th><th className="py-1.5 font-medium">Gate decision</th><th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {versions.map((v) => (
              <tr key={v.version}>
                <td className="py-1.5 font-mono text-gray-800">{v.version}</td>
                <td className="py-1.5"><VersionStatus status={v.status} /></td>
                <td className="py-1.5 text-right tabular-nums">{f1(v.macro_f1)}</td>
                <td className="py-1.5 text-right tabular-nums">{pct(v.accuracy)}</td>
                <td className="py-1.5 text-gray-600">{v.training_data ?? "—"}</td>
                <td className="py-1.5 text-gray-600 max-w-xs truncate" title={v.decision ?? ""}>{v.decision ?? "—"}</td>
                <td className="py-1.5 text-right">
                  {isAdmin && v.can_activate && (
                    <button className="text-blue-700 hover:underline" disabled={!!busy}
                      onClick={() => act("activate", () => call(`/api/models/automation/versions/${v.version}/activate`, "POST"),
                        `Version ${v.version} is now active. Re-score datasets to apply it.`)}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-md px-2.5 py-1.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function VersionStatus({ status }: { status: string }) {
  const style: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-gray-50 text-gray-500 border-gray-200",
    deprecated: "bg-gray-50 text-gray-500 border-gray-200",
    candidate: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${style[status] ?? style.deprecated}`}>{status}</span>;
}
