"use client";
import RecommendPanel from "../../../components/RecommendPanel";

export default function RecommendationsPage() {
  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Recommendations</h1>
        <p className="dash-sub">Ranked places for your workspace, with explainable scores.</p>
      </div>
      <RecommendPanel />
    </>
  );
}