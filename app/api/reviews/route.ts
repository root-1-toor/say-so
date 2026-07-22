import { NextResponse } from "next/server";

export type Review = {
  id: string;
  name: string;
  rating: number;
  transcript: string;
  audio: string; // data URL (audio/webm;base64)
  durationSec: number;
  createdAt: string;
};

// In-memory store — demo-grade. Resets on redeploy/cold start.
// For persistence: put audio blobs in Vercel Blob / S3 and rows in KV/Postgres.
const g = globalThis as unknown as { __reviews?: Review[] };
if (!g.__reviews) g.__reviews = [];

const MAX_AUDIO_BYTES = 3_500_000; // ~3.5MB base64, under Vercel's 4.5MB body limit

export async function GET() {
  return NextResponse.json({ reviews: g.__reviews });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const audio = typeof body?.audio === "string" ? body.audio : "";
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Anonymous";
  const rating = Math.min(5, Math.max(1, Number(body?.rating) || 5));
  const durationSec = Math.max(0, Math.round(Number(body?.durationSec) || 0));

  if (!audio.startsWith("data:audio/")) {
    return NextResponse.json({ error: "Audio recording is required." }, { status: 400 });
  }
  if (audio.length > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Recording too large. Keep reviews under a minute." },
      { status: 413 }
    );
  }

  const review: Review = {
    id: crypto.randomUUID(),
    name: name.slice(0, 60),
    rating,
    transcript: transcript.slice(0, 2000),
    audio,
    durationSec,
    createdAt: new Date().toISOString()
  };
  g.__reviews!.unshift(review);
  g.__reviews = g.__reviews!.slice(0, 30); // keep memory sane with audio payloads
  return NextResponse.json({ review }, { status: 201 });
}

export async function DELETE(req: Request) {
  const required = process.env.CLEAR_KEY;
  if (required) {
    const provided = req.headers.get("x-clear-key");
    if (provided !== required) {
      return NextResponse.json({ error: "Wrong key." }, { status: 401 });
    }
  }
  g.__reviews = [];
  return NextResponse.json({ cleared: true });
}
