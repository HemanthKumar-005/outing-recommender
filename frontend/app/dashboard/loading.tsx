export default function Loading() {
  return (
    <div className="dash-content" aria-busy="true" aria-live="polite">
      <div className="skeleton" style={{ width: 240, height: 28, marginBottom: 16 }} />
      <div className="skeleton" style={{ width: "100%", height: 160 }} />
    </div>
  );
}
