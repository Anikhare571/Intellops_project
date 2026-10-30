"use client";
/**
 * Model Evaluation
 * Everything shown here comes from /api/system/model-evaluation:
 *   - training report: held-out test, baselines, calibration, CV, SHAP
 *   - what the classifier did on the selected upload
 *   - end-to-end check vs ground truth, when evaluate_upload.py was run for it
 */
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "./StatCard";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CLASSES = ["Already Automated", "Can Be Automated", "Manual Only"];
const BAR = "#2563EB";

const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const num = (v: number | null | undefined, d = 3) => (v == null ? "—" : v.toFixed(d));

export default function ModelEvaluation({ uploadId }: { uploadId: number }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [shapClass, setShapClass] = useState("overall");

  useEffect(() => {
    if (!uploadId) return;
    const token = localStorage.getItem("token");
    setData(null);
    setError(null);
    fetch(`${API}/api/system/model-evaluation/${uploadId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => (r.ok ? setData(await r.json()) : setError((await r.json()).detail || r.statusText)))
      .catch((e) => setError(String(e)));
  }, [uploadId]);

  if (error) return <Empty title="No evaluation available" detail={error} />;
  if (!data) return <div className="text-sm text-gray-500">Loading evaluation…</div>;

  const t = data.training;
  const best = t.test_results[t.test_results.length - 1];
  const cv = t.cross_validation?.XGBoost;
  const shap = (t.feature_importance_shap[shapClass] || []).slice(0, 15);
  const gt = data.ground_truth_check;
  const up = data.upload;

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h2 className="text-sm font-semibold text-gray-900">Automation status classifier</h2>
        <p className="text-sm text-gray-500 mt-1">
          XGBoost on TF-IDF text and ticket fields, isotonic calibration. Trained {t.generated_at.replace("T", " ")} on{" "}
          <code>{t.data.tickets}</code>: {t.data.split.train.toLocaleString()} train /{" "}
          {t.data.split.val.toLocaleString()} validation / {t.data.split.test.toLocaleString()} held-out test tickets.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Test accuracy" value={pct(best.accuracy)} subValue={`${t.data.split.test} unseen tickets`} />
        <StatCard label="Test macro F1" value={num(best.macro_f1)} subValue="mean F1 across the 3 classes" />
        <StatCard
          label="5-fold CV macro F1"
          value={cv ? num(cv.macro_f1_mean) : "—"}
          subValue={cv ? `± ${num(cv.macro_f1_std)} across folds` : undefined}
        />
        <StatCard
          label="Calibration error (ECE)"
          value={num(t.calibration.ece_after)}
          subValue={`${num(t.calibration.ece_before)} before isotonic calibration`}
        />
      </div>

      {gt && (
        <Section
          title={`End-to-end check: upload #${gt.upload_id} vs ground truth`}
          note={`${gt.n_tickets.toLocaleString()} tickets matched to ${gt.labels_file}, evaluated ${gt.evaluated_at.replace("T", " ")}.
          This is what the dashboard actually shows, scored against the true labels.`}
        >
          <Table
            head={["Source", "Accuracy", "Macro F1"]}
            rows={[
              ...gt.results.map((r: any) => [r.name, pct(r.accuracy), num(r.macro_f1)]),
              ...(gt.categories
                ? [
                    ["L1 tower (l1_category)", pct(gt.categories.l1_tower_accuracy), "—"],
                    ["L2 subcategory (l2_subcategory)", pct(gt.categories.l2_subcategory_accuracy), "—"],
                  ]
                : []),
            ]}
          />
        </Section>
      )}

      <Section
        title="Held-out test: model vs baselines"
        note="Every model is scored on the same held-out test split. A model only earns its place if it beats the simple baselines."
      >
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          <Table
            head={["Model", "Accuracy", "Macro F1"]}
            rows={t.test_results.map((m: any) => [m.model, pct(m.accuracy), num(m.macro_f1)])}
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={t.test_results} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid horizontal={false} stroke="#F3F4F6" />
              <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 11, fill: "#6B7280" }} />
              <YAxis type="category" dataKey="model" width={150} tick={{ fontSize: 11, fill: "#374151" }} />
              <Tooltip formatter={(v: any): any => [num(Number(v)), "Macro F1"]} cursor={{ fill: "#F9FAFB" }} />
              <Bar dataKey="macro_f1" fill={BAR} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Per-class results (test)">
          <Table
            head={["Class", "Precision", "Recall", "F1", "Support"]}
            rows={CLASSES.map((c) => {
              const v = best.per_class[c];
              return [c, num(v.precision), num(v.recall), num(v["f1-score"]), String(v.support)];
            })}
          />
        </Section>
        <Section title="Confusion matrix (test)" note="Rows are the true class, columns the predicted class.">
          <ConfusionMatrix matrix={best.confusion_matrix} />
        </Section>
      </div>

      <Section
        title="What drives the prediction (SHAP)"
        note="Mean absolute SHAP value per feature on the test set: how much each feature moves the model's output on average."
      >
        <div className="flex gap-2 mb-3 flex-wrap">
          {["overall", ...CLASSES].map((c) => (
            <button
              key={c}
              onClick={() => setShapClass(c)}
              className={`px-3 py-1 rounded-md text-xs border ${
                shapClass === c ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              {c === "overall" ? "All classes" : c}
            </button>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={Math.max(220, shap.length * 24)}>
          <BarChart data={shap} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid horizontal={false} stroke="#F3F4F6" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#6B7280" }} />
            <YAxis type="category" dataKey="feature" width={230} tick={{ fontSize: 11, fill: "#374151" }} />
            <Tooltip formatter={(v: any): any => [num(Number(v)), "mean |SHAP|"]} cursor={{ fill: "#F9FAFB" }} />
            <Bar dataKey="importance" fill={BAR} radius={[0, 4, 4, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section
          title="Automation score tiers (test)"
          note="Score = calibrated P(automatable) × 100. A useful score separates tickets: high tiers should be mostly automatable, low tiers mostly not."
        >
          <Table
            head={["Tier", "Tickets", "Actually automatable"]}
            rows={t.score_tiers.map((s: any) => [s.tier, String(s.tickets), pct(s.actually_automatable)])}
          />
        </Section>
        <Section title={`Model output on upload #${uploadId}`}>
          {up ? (
            <Table
              head={["", "Tickets"]}
              rows={[
                ...Object.entries(up.status_counts).map(([k, v]) => [k, (v as number).toLocaleString()]),
                ...Object.entries(up.tier_counts).map(([k, v]) => [`Tier: ${k}`, (v as number).toLocaleString()]),
                ["Mean confidence", pct(up.mean_confidence)],
              ]}
            />
          ) : (
            <p className="text-sm text-gray-500">The classifier has not scored this upload (it was processed before the model existed).</p>
          )}
        </Section>
      </div>

      <Section title="Example errors (test)" note="Reading errors is how the next improvement is found. Some are label noise: the model is right and the label is wrong.">
        <ul className="space-y-2">
          {t.error_examples.map((e: any) => (
            <li key={e.number} className="text-xs text-gray-600 border-b border-gray-100 pb-2">
              <span className="font-mono text-gray-900">{e.number}</span>: true <b>{e.true}</b>, predicted <b>{e.predicted}</b>
              <div className="text-gray-500 mt-0.5">{e.text}</div>
            </li>
          ))}
        </ul>
      </Section>

      {data.category && <CategorySection report={data.category} upload={data.category_upload} />}
      {data.clustering && <ClusteringSection report={data.clustering} upload={data.cluster_quality} />}
      {data.anomaly && <AnomalySection report={data.anomaly} />}

      <Section title="Volume forecast">
        <p className="text-sm text-gray-600">
          Seasonal-naive, weekday-mean, ridge-on-lags and LSTM forecasters are compared per upload in a rolling-origin
          backtest; the simplest model within 3% of the best MAE is used, with 80% intervals from its backtest errors.
          Results for this upload are on the <b>SLA &amp; Forecast</b> page.
        </p>
      </Section>

      <p className="text-xs text-gray-400">
        Trained and tested on synthetic, confidentiality-safe tickets with deliberate noise (vague descriptions, wrong
        categories, misrouting, 3% flipped labels, planted anomalies). Expect lower scores on real ticket dumps.
      </p>
    </div>
  );
}

function CategorySection({ report, upload }: { report: any; upload: any }) {
  const names: Record<string, string> = { l1: "L1 tower", l2: "L2 subcategory" };
  return (
    <Section
      title="Ticket categorisation (L1 tower / L2 subcategory)"
      note="Logistic regression on TF-IDF word and character n-grams plus channel, category field and priority. Creation-time inputs only: closure notes and the assigned team are excluded because they don't exist when a ticket needs routing."
    >
      <div className="grid lg:grid-cols-2 gap-6">
        {Object.entries(report.levels).map(([level, r]: [string, any]) => (
          <div key={level}>
            <div className="text-xs font-semibold text-gray-700 mb-1">
              {names[level] || level} · {r.n_classes} classes · held-out test
            </div>
            <Table
              head={["Model", "Accuracy", "Macro F1"]}
              rows={r.test_results.map((m: any) => [m.model, pct(m.accuracy), num(m.macro_f1)])}
            />
            <div className="text-xs font-semibold text-gray-700 mt-4 mb-1">Auto-route only when confident</div>
            <Table
              head={["Confidence ≥", "Share of tickets", "Accuracy"]}
              rows={r.selective_accuracy.map((s: any) => [String(s.threshold), pct(s.coverage), pct(s.accuracy)])}
            />
          </div>
        ))}
      </div>
      {upload && (
        <p className="text-xs text-gray-500 mt-3">
          This upload: {pct(upload.auto_routable_share)} of tickets reach the {upload.auto_route_threshold} confidence
          threshold and could be routed without a human.
        </p>
      )}
    </Section>
  );
}

function ClusteringSection({ report, upload }: { report: any; upload: any }) {
  return (
    <Section
      title="Clustering quality"
      note="KMeans on sentence embeddings. Silhouette needs no labels (used to choose k); ARI / NMI compare clusters with the true subcategories, which only synthetic data allows."
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <Table
          head={["k", "Silhouette", "ARI vs truth", "NMI vs truth"]}
          rows={report.kmeans.map((r: any) => [String(r.k), num(r.silhouette), num(r.ari_subcategory), num(r.nmi_subcategory)])}
        />
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            HDBSCAN for comparison: {report.hdbscan.clusters} clusters, {pct(report.hdbscan.noise_share)} noise, ARI{" "}
            {num(report.hdbscan.ari_subcategory)}.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
            {(report.notes || []).map((n: string) => <li key={n}>{n}</li>)}
          </ul>
          {upload && (
            <p className="text-xs text-gray-500">
              This upload: k = {upload.chosen_k} ({upload.method}), silhouette {num(upload.final_silhouette)}.
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}

function AnomalySection({ report }: { report: any }) {
  return (
    <Section
      title="Anomaly detection"
      note="IsolationForest on features measured against each ticket's own type. Scored against anomalies planted in the synthetic data (resolution-time outliers, reassignment storms, off-hours P1s)."
    >
      <div className="grid lg:grid-cols-2 gap-6">
        {Object.entries(report.datasets).map(([name, d]: [string, any]) => (
          <div key={name}>
            <div className="text-xs font-semibold text-gray-700 mb-1">
              {name} · {d.true_anomalies} anomalies in {d.tickets.toLocaleString()} tickets (base rate {pct(d.base_rate)})
            </div>
            <Table
              head={["Method", "Avg precision", "Precision@k"]}
              rows={d.results.map((r: any) => [r.model, num(r.average_precision), num(r.precision_at_k)])}
            />
            <p className="text-xs text-gray-500 mt-2">
              Flagged {d.operating_point.flagged}: precision {pct(d.operating_point.precision)}, recall{" "}
              {pct(d.operating_point.recall)}. Recall by type:{" "}
              {Object.entries(d.recall_by_anomaly_type).map(([k, v]: [string, any]) => `${k.replace("_", " ")} ${pct(v, 0)}`).join(", ")}.
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      {note && <p className="text-xs text-gray-500 mt-1 mb-3">{note}</p>}
      <div className={note ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
          {head.map((h) => (
            <th key={h} className="py-2 pr-3 font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-gray-100 last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`py-2 pr-3 ${j === 0 ? "text-gray-900" : "text-gray-700 tabular-nums"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${CLASSES.length}, 1fr)` }}>
      <div />
      {CLASSES.map((c) => (
        <div key={c} className="text-[11px] text-gray-500 text-center pb-1">{c}</div>
      ))}
      {matrix.map((row, i) => (
        <Row key={i} label={CLASSES[i]} row={row} max={max} diag={i} />
      ))}
    </div>
  );
}

function Row({ label, row, max, diag }: { label: string; row: number[]; max: number; diag: number }) {
  return (
    <>
      <div className="text-[11px] text-gray-500 flex items-center">{label}</div>
      {row.map((v, j) => {
        const share = v / max;
        return (
          <div
            key={j}
            title={`True ${label}, predicted ${CLASSES[j]}: ${v}`}
            className="h-12 rounded flex items-center justify-center text-sm tabular-nums"
            style={{
              background: `rgba(37, 99, 235, ${0.06 + share * 0.84})`,
              color: share > 0.5 ? "#FFFFFF" : "#111827",
              fontWeight: j === diag ? 600 : 400,
            }}
          >
            {v}
          </div>
        );
      })}
    </>
  );
}

function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="p-10 text-center text-gray-500">
      <div className="text-base font-semibold text-gray-700">{title}</div>
      <div className="text-sm mt-1">{detail}</div>
    </div>
  );
}
