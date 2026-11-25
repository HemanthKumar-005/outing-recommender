"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_API_KEY || "demo-key";

type EvalRow = { strategy: string; "precision@k": string; "recall@k": string; "ndcg@k": string; map: string };

type ModelCardResponse = {
  model_loaded: boolean;
  metadata: {
    model_name: string;
    version: string;
    training_date: string;
    dataset_version: string;
    feature_version: string;
    feature_names: string[];
    metrics: Record<string, number>;
  } | null;
  ranking_config: {
    cold_start: { min_interactions_for_cf: number };
    profiles: Record<string, Record<string, number>>;
    group_aggregation: { default_method: string };
    diversity: { default: number };
    place_exploration: { strength: number; max_bonus: number; review_count_ceiling: number };
  };
  evaluation_results: EvalRow[];
  evaluation_note: string;
};

export default function ModelCard() {
  const [data, setData] = useState<ModelCardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${DEFAULT_API_URL}/recommendations/model-card`, {
      headers: { "X-API-Key": DEFAULT_API_KEY },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="page">
      <div className="top-row">
        <div>
          <p className="eyebrow">Nearby &amp; Co. · Transparency</p>
          <h1>How this ranks</h1>
          <p className="subtitle">The current model, its weights, and the last offline evaluation run — no black box.</p>
        </div>
        <Link href="/" className="btn-secondary" style={{ textDecoration: "none" }}>← Back</Link>
      </div>

      {error && <div className="card"><div className="error">{error}</div></div>}
      {!data && !error && <div className="card"><p className="empty">Loading model card...</p></div>}

      {data && (
        <>
          <div className="card fade-in">
            <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>Current model</p>
            {data.metadata ? (
              <>
                <p style={{ margin: "0 0 4px" }}>
                  <strong>{data.metadata.model_name}</strong> · version <code>{data.metadata.version}</code>
                </p>
                <p className="hint">
                  Trained {new Date(data.metadata.training_date).toLocaleString()} on dataset{" "}
                  <code>{data.metadata.dataset_version}</code>, feature schema <code>{data.metadata.feature_version}</code>
                </p>
                <div className="metric-grid">
                  {Object.entries(data.metadata.metrics).map(([k, v]) => (
                    <div className="metric-tile" key={k}>
                      <div className="metric-value">{v}</div>
                      <div className="metric-label">{k.replace(/_/g, " ")}</div>
                    </div>
                  ))}
                </div>
                <p className="hint">Features: {data.metadata.feature_names.join(", ")}</p>
              </>
            ) : (
              <p className="empty">
                No model trained yet — run <code>docker compose run --rm model-training-worker</code>.
                Recommendations currently fall back to a neutral ML score.
              </p>
            )}
          </div>

          <div className="card fade-in">
            <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>Ranking weights (config-driven, not hard-coded)</p>
            {Object.entries(data.ranking_config.profiles).map(([profile, weights]) => (
              <div key={profile} style={{ marginBottom: 14 }}>
                <p style={{ margin: "10px 0 4px", fontWeight: 600 }}>{profile.replace(/_/g, " ")}</p>
                <div className="metric-grid">
                  {Object.entries(weights).map(([k, v]) => (
                    <div className="metric-tile" key={k}>
                      <div className="metric-value">{v}</div>
                      <div className="metric-label">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="hint">
              New guests (fewer than {data.ranking_config.cold_start.min_interactions_for_cf} saved/visited/rated places)
              use the "new user" profile, which excludes collaborative filtering entirely rather than letting a cold CF
              signal drag scores down.
            </p>
            <p className="hint">
              Group requests combine each guest's score via <code>{data.ranking_config.group_aggregation.default_method}</code>{" "}
              by default. Default explore/exploit diversity is {Math.round(data.ranking_config.diversity.default * 100)}%.
              Places with fewer than {data.ranking_config.place_exploration.review_count_ceiling} reviews get a small
              exploration bonus (up to +{data.ranking_config.place_exploration.max_bonus}) so new venues aren't permanently
              buried under already-popular ones.
            </p>
          </div>

          <div className="card fade-in">
            <p className="eyebrow" style={{ color: "var(--on-paper-muted)" }}>Offline evaluation &amp; ablation</p>
            <p className="hint">{data.evaluation_note}</p>
            {data.evaluation_results.length === 0 ? (
              <p className="empty">
                No evaluation run yet — run <code>python3 scripts/evaluate.py</code> from the project root.
              </p>
            ) : (
              <table className="eval-table">
                <thead>
                  <tr>
                    <th>Strategy</th><th>P@K</th><th>R@K</th><th>NDCG@K</th><th>MAP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.evaluation_results.map((row) => (
                    <tr key={row.strategy}>
                      <td>{row.strategy}</td>
                      <td>{row["precision@k"]}</td>
                      <td>{row["recall@k"]}</td>
                      <td>{row["ndcg@k"]}</td>
                      <td>{row.map}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </main>
  );
}
