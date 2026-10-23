"use client";

import { useState } from "react";
import { reportPlaceIssue } from "../lib/api";

const ISSUES: { value: string; label: string }[] = [
  { value: "closed", label: "Permanently closed" },
  { value: "does_not_exist", label: "This place doesn't exist" },
  { value: "wrong_hours", label: "Wrong opening hours" },
  { value: "wrong_price", label: "Wrong price" },
  { value: "wrong_location", label: "Wrong location" },
  { value: "other", label: "Something else" },
];

export default function ReportIssue({ placeId, placeName }: { placeId: number; placeName: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("closed");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  if (state === "done") return <span className="hint" role="status">Thanks, we&apos;ll check it.</span>;

  if (!open) {
    return (
      <button type="button" className="btn-tiny" onClick={() => setOpen(true)} aria-label={`Report a problem with ${placeName}`}>
        ⚑ Report an issue
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
      <select className="form-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Issue type">
        {ISSUES.map((i) => (
          <option key={i.value} value={i.value}>{i.label}</option>
        ))}
      </select>
      <input className="form-input" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details (optional)" maxLength={500} />
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={state === "sending"}
          onClick={async () => {
            setState("sending");
            try {
              await reportPlaceIssue(placeId, type, details);
              setState("done");
            } catch {
              setState("error");
            }
          }}
        >
          {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {state === "error" && <span className="form-error" role="alert">Could not send. Please try again.</span>}
    </div>
  );
}
