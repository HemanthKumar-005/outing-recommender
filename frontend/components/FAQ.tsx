"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "../lib/demo-data";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
          <button
            type="button"
            className="faq-question"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {item.q}
            <span className="faq-icon">+</span>
          </button>
          <div className="faq-answer">{item.a}</div>
        </div>
      ))}
    </div>
  );
}
