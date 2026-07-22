"use client";

import { useCallback, useEffect, useState } from "react";
import type { Review } from "@/app/api/reviews/route";

export default function ReviewFeed({ refreshKey }: { refreshKey: number }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTranscripts, setOpenTranscripts] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews", { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load reviews. Refresh to retry.");
      const data = await res.json();
      setReviews(data.reviews);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (error) return <p className="text-sm text-signal">{error}</p>;
  if (!reviews) return <p className="text-sm text-fog">Loading reviews…</p>;
  if (reviews.length === 0)
    return <p className="text-sm text-fog">Silence so far. Yours goes first.</p>;

  return (
    <ul className="space-y-4">
      {reviews.map((r) => (
        <li key={r.id} className="border-2 border-ink bg-white p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="font-display font-bold uppercase tracking-wide">
              {r.name}
            </span>
            <span className="flex items-baseline gap-3 text-sm">
              {r.durationSec > 0 && (
                <span className="text-xs text-fog">{fmt(r.durationSec)}</span>
              )}
              <span aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
                <span className="text-fog">{"★".repeat(5 - r.rating)}</span>
              </span>
            </span>
          </div>

          <audio controls src={r.audio} className="w-full" preload="metadata" />

          {r.transcript && (
            <div className="mt-3">
              <button
                onClick={() =>
                  setOpenTranscripts((o) => ({ ...o, [r.id]: !o[r.id] }))
                }
                aria-expanded={Boolean(openTranscripts[r.id])}
                className="text-xs uppercase tracking-widest text-pine underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              >
                {openTranscripts[r.id] ? "Hide transcript" : "Show transcript"}
              </button>
              {openTranscripts[r.id] && (
                <p className="mt-2 border-l-2 border-ink pl-3 text-sm leading-relaxed">
                  &ldquo;{r.transcript}&rdquo;
                </p>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-fog">
            {new Date(r.createdAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
