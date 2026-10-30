"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "../lib/demo-data";
import { Icons } from "./Icons";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={i} className={`faq-item ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              className="faq-question"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span>{item.q}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "transform 0.2s ease",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  color: isOpen ? "var(--coral-400)" : "var(--text-muted)",
                }}
              >
                <Icons.ChevronDown size={18} />
              </span>
            </button>
            <div className="faq-answer">{item.a}</div>
          </div>
        );
      })}
    </div>
  );
}
