"use client";

import { useState } from "react";
import Recorder from "@/components/Recorder";
import ReviewFeed from "@/components/ReviewFeed";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-10">
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-fog">
          Voice → Posted → Played
        </p>
        <h1 className="font-display text-5xl font-black uppercase leading-none sm:text-6xl">
          Say <span className="text-signal">So</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed">
          Record your review in your actual voice — tone, excitement, hesitation
          and all. It posts to the wall below with a play button, plus an
          optional transcript for accessibility and search.
        </p>
      </header>

      <section aria-label="Record a review" className="mb-12">
        <Recorder onPosted={() => setRefreshKey((k) => k + 1)} />
      </section>

      <section aria-label="Reviews">
        <h2 className="mb-4 font-display text-xl font-bold uppercase tracking-wide">
          The Wall
        </h2>
        <ReviewFeed refreshKey={refreshKey} />
      </section>

      <footer className="mt-14 border-t-2 border-ink pt-4 text-xs text-fog">
        Demo build · Recording works in modern browsers over HTTPS; live transcription is best in Chrome/Edge.
      </footer>
    </main>
  );
}
