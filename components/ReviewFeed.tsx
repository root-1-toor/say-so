"use client";

import { useCallback, useEffect, useState } from "react";
import type { Review } from "@/app/api/reviews/route";

export default function ReviewFeed({ refreshKey }: { refreshKey: number }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTranscripts, setOpenTranscripts] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState(false);

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

  const clearWall = async () => {
    if (!window.confirm("Clear every review on the wall? This can't be undone.")) return;
    setClearing(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      // Only prompted if the deployment sets CLEAR_KEY — harmless no-op otherwise.
      const key = window.prompt("Clear key (leave blank if none is set):", "");
      if (key) headers["x-clear-key"] = key;

      const res = await fetch("/api/reviews", { method: "DELETE", headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't clear the wall.");
      }
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setClearing(false);
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!reviews) return <p className="text-sm text-fog">Loading reviews…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {error && <p className="text-sm text-signal">{error}</p>}
        {reviews.length > 0 && (
          <button
            onClick={clearWall}
            disabled={clearing}
            className="ml-auto text-xs uppercase tracking-widest text-fog underline underline-offset-4 hover:text-signal disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            {clearing ? "Clearing…" : "Clear wall"}
          </button>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-fog">Silence so far. Yours goes first.</p>
      ) : (
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
      )}
    </div>
  );
}
