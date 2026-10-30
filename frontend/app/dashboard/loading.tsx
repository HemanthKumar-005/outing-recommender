export default function DashboardLoading() {
  return (
    <div className="dash-content fade-in" aria-busy="true" aria-live="polite">
      {/* Header skeleton */}
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 220, height: 32, marginBottom: 8, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: 340, height: 16, borderRadius: 6 }} />
      </div>

      {/* Grid skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, maxWidth: 680 }}>
        <div className="skeleton" style={{ width: "100%", height: 180, borderRadius: 14 }} />
        <div className="skeleton" style={{ width: "100%", height: 180, borderRadius: 14 }} />
        <div className="skeleton" style={{ width: "100%", height: 180, borderRadius: 14 }} />
      </div>
    </div>
  );
}
