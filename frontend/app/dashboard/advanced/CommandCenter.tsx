"use client";
/**
 * Model Health: which models ran on this dataset, what they produced, how they
 * were trained, and the registry of trained versions. Data: /api/ml-models.
 */
import { useEffect, useState } from "react";
import { ChevronRight, Loader2, RefreshCw } from "lucide-react";
import BERTDrillDown from "./BERTDrillDown";
import XGBoostDrillDown from "./XGBoostDrillDown";
import ModelLifecycle from "../components/ModelLifecycle";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const hours = (h: number | null | undefined) => (h == null ? "—" : h >= 100 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`);

const STATUS_STYLE: Record<string, string> = {
  trained: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rules: "bg-amber-50 text-amber-700 border-amber-200",
  pretrained: "bg-blue-50 text-blue-700 border-blue-200",
  not_run: "bg-gray-50 text-gray-500 border-gray-200",
};
const STATUS_LABEL: Record<string, string> = { trained: "Trained model", rules: "Rule-based", pretrained: "Pretrained LLM", not_run: "Not run" };

function ModelCard({ title, status, rows, onOpen, note }: {
  title: string; status: string; rows: [string, string][]; onOpen?: () => void; note?: string;
}) {
  return (
    <button
      type="button"
      disabled={!onOpen}
      onClick={onOpen}
      className="group text-left bg-white border border-gray-200 rounded-lg p-4 enabled:hover:border-blue-300 disabled:cursor-default"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded border ${STATUS_STYLE[status] ?? STATUS_STYLE.not_run}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-gray-500">{k}</dt>
            <dd className="text-sm font-medium text-gray-900 tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-3 text-[11px] leading-snug text-amber-700">{note}</p>}
      {onOpen && (
        <div className="mt-3 flex items-center gap-1 text-xs text-blue-700 opacity-0 group-hover:opacity-100">
          Details <ChevronRight className="w-3.5 h-3.5" />
        </div>
      )}
    </button>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function trainedOn(model: any): string {
  return model?.training_data ? model.training_data.replace(/\.(csv|xlsx?)$/i, "") : "training";
}

export default function CommandCenter({ uploadId, onNavigate }: { uploadId: number; onNavigate?: (view: string) => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drill, setDrill] = useState<"bert" | "xgboost" | null>(null);
  const [me, setMe] = useState<{ role?: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((r) => (r.ok ? r.json() : null)).then(setMe).catch(() => setMe(null));
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/ml-models/${uploadId}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (uploadId) load();
  }, [uploadId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (error || !data) return <p className="text-sm text-red-600">Could not load model status: {error}</p>;

  const { bert_clustering: emb, xgboost_scorer: auto, category_classifier: cat, aiops_classifier: llm } = data.models;
  const m = data.mttr_analysis.by_status;
  const tr = data.training_data;
  const total = data.total_tickets;
  const b = auto.automation_breakdown;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        {!auto.validated_on_dataset ? (
          <div className="flex-1 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
            <p className="text-sm text-amber-800">
              Model accuracy has not been measured on this dataset. Labelling a random sample of tickets measures it and adds training data.
            </p>
            <button onClick={() => onNavigate?.("review")} className="btn-primary shrink-0">Label tickets</button>
          </div>
        ) : <div />}
        <button onClick={load} className="btn-secondary"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <ModelCard
          title={auto.name}
          status={auto.status}
          onOpen={() => setDrill("xgboost")}
          rows={[
            ["Test accuracy", pct(auto.test_metrics?.accuracy)],
            ["Test macro F1", auto.test_metrics ? auto.test_metrics.macro_f1.toFixed(3) : "—"],
            ["Agrees with rule detector", pct(auto.rule_detector_agreement)],
            ["Tickets scored", auto.tickets_scored.toLocaleString()],
          ]}
          note={auto.validated_on_dataset ? undefined : `Test scores are from the ${trainedOn(tr.automation_model)} held-out test set. Accuracy on this dataset is not yet measured.`}
        />
        <ModelCard
          title={cat.name}
          status={cat.status}
          rows={[
            ["Test accuracy L1", pct(cat.test_accuracy?.l1)],
            ["Test accuracy L2", pct(cat.test_accuracy?.l2)],
            ["Auto-routable", cat.auto_routable_share != null ? `${pct(cat.auto_routable_share, 0)} at ≥${cat.auto_route_threshold}` : "—"],
            ["Tickets classified", cat.tickets_labelled.toLocaleString()],
          ]}
          note={cat.validated_on_dataset ? undefined : `Test scores are from the ${trainedOn(tr.category_model)} held-out test set. Accuracy on this dataset is not yet measured.`}
        />
        <ModelCard
          title={emb.name}
          status={emb.status}
          onOpen={() => setDrill("bert")}
          rows={[
            ["Clusters", String(emb.clusters_found)],
            ["Silhouette", emb.silhouette != null ? emb.silhouette.toFixed(3) : "—"],
            ["Embedding size", emb.dimensions ? `${emb.dimensions}-d` : "—"],
            ["Tickets", emb.tickets_processed.toLocaleString()],
          ]}
        />
        <ModelCard
          title={llm.name}
          status={llm.status}
          rows={[
            ["Tickets categorised", llm.tickets_classified.toLocaleString()],
            ["Towers found", String(llm.towers_found)],
            ["Sample agreement", pct(llm.mean_sample_agreement)],
            ["Calls", "Sampled per cluster"],
          ]}
          note="Qwen 2.5 7B labels a few sample tickets per cluster; the majority answer is applied to the whole cluster. Sample agreement = share of samples that agreed."
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Panel title="Automation status" note="Predicted by the automation classifier">
          <div className="space-y-3">
            {[["Already automated", b.already_automated], ["Can be automated", b.can_automate], ["Manual only", b.manual_only]].map(([k, v]) => (
              <div key={k as string}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700">{k}</span>
                  <span className="tabular-nums text-gray-900">{(v as number).toLocaleString()} <span className="text-gray-500">({((v as number) / total * 100).toFixed(1)}%)</span></span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${(v as number) / total * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Resolution time by automation status" note="Different ticket populations: a comparison, not a measured saving">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {[["All tickets", m.overall], ["Automated", m.automated], ["Can be automated", m.can_automate], ["Manual only", m.manual_only]].map(([k, v]: any) => (
                <tr key={k}>
                  <td className="py-1.5 text-gray-700">{k}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{hours(v.avg_hours)}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-500 text-xs">{v.tickets.toLocaleString()} tickets</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Training provenance" note="What the models applied to this dataset were trained on">
          <dl className="space-y-2 text-sm">
            {[["Automation classifier", tr.automation_model], ["Category classifier", tr.category_model]].map(([k, v]: any) => (
              <div key={k}>
                <dt className="text-xs text-gray-500">{k}</dt>
                <dd className="text-gray-900">{v ? `${v.n_train?.toLocaleString()} labelled tickets from ${v.training_data}, trained ${String(v.trained_at).replace("T", " ")}` : "Not trained"}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-gray-500">Analyst corrections on this dataset</dt>
              <dd className="text-gray-900 tabular-nums">{tr.analyst_corrections.toLocaleString()}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <ModelLifecycle uploadId={uploadId} isAdmin={me?.role === "admin"} onRescored={() => setTimeout(load, 60000)} />

      <BERTDrillDown uploadId={uploadId} isOpen={drill === "bert"} onClose={() => setDrill(null)} />
      <XGBoostDrillDown uploadId={uploadId} isOpen={drill === "xgboost"} onClose={() => setDrill(null)} />
    </div>
  );
}
