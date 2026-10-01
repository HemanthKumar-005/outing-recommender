"use client";
import RecommendPanel from "../../../components/RecommendPanel";

export default function DiscoverPage() {
  return (
    <>
      <div className="dash-header">
        <h1 className="dash-greeting">Discover</h1>
        <p className="dash-sub">Explore places with live recommendation scoring from the engine.</p>
      </div>
      <RecommendPanel />
    </>
  );
}
