"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = { onPosted: () => void };

const MAX_SECONDS = 60;

function getRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function Recorder({ onPosted }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0); // 0..1 mic input level
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const recogRef = useRef<any>(null);
  const keepAlive = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    setSpeechSupported(Boolean(getRecognition()));
  }, []);

  const teardown = useCallback(() => {
    keepAlive.current = false;
    recogRef.current?.stop?.();
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const stop = useCallback(() => {
    mediaRef.current?.state !== "inactive" && mediaRef.current?.stop();
    setRecording(false);
    setInterim("");
  }, []);

  const start = useCallback(async () => {
    setStatus(null);
    setAudioUrl(null);
    blobRef.current = null;
    setFinalText("");
    setInterim("");
    setElapsed(0);
    durationRef.current = 0;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("Microphone access was blocked. Allow mic permission and try again.");
      return;
    }
    streamRef.current = stream;

    // --- audio capture ---
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const mr = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 48000 });
    chunksRef.current = [];
    mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      blobRef.current = blob;
      setAudioUrl(URL.createObjectURL(blob));
      teardown();
    };
    mediaRef.current = mr;

    // --- live level meter ---
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // --- parallel transcription (best-effort) ---
    const recog = getRecognition();
    if (recog) {
      recog.lang = "en-US";
      recog.continuous = true;
      recog.interimResults = true;
      recog.onresult = (e: any) => {
        let chunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            setFinalText((p) => (p ? p + " " : "") + r[0].transcript.trim());
          } else chunk += r[0].transcript;
        }
        setInterim(chunk);
      };
      recog.onend = () => {
        if (keepAlive.current) {
          try { recog.start(); } catch {}
        }
      };
      recogRef.current = recog;
      keepAlive.current = true;
      try { recog.start(); } catch {}
    }

    // --- timer + cap ---
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setElapsed(durationRef.current);
      if (durationRef.current >= MAX_SECONDS) stop();
    }, 1000);

    mr.start();
    setRecording(true);
  }, [stop, teardown]);

  const discard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setFinalText("");
    setInterim("");
    setElapsed(0);
  };

  const submit = async () => {
    const blob = blobRef.current;
    if (!blob) {
      setStatus("Record something first.");
      return;
    }
    setPosting(true);
    setStatus(null);
    try {
      const audio = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(new Error("Couldn't read the recording."));
        r.readAsDataURL(blob);
      });
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio,
          transcript: finalText.trim(),
          name,
          rating,
          durationSec: durationRef.current
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Posting failed. Try again.");
      }
      discard();
      setName("");
      setRating(5);
      setStatus("Posted. Press play on it below.");
      onPosted();
    } catch (err: any) {
      setStatus(err.message);
    } finally {
      setPosting(false);
    }
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="border-2 border-ink bg-white">
      {/* Tape header */}
      <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
          <span
            className={`inline-block h-3 w-3 rounded-full ${
              recording ? "bg-signal rec-dot" : "bg-fog"
            }`}
            aria-hidden
          />
          {recording ? `Recording ${fmt(elapsed)} / ${fmt(MAX_SECONDS)}` : "Standby"}
        </div>
        {/* live level meter */}
        <div className="flex h-4 items-end gap-[3px]" aria-hidden>
          {[0.25, 0.5, 0.75, 1].map((t, i) => (
            <span
              key={i}
              className={`w-1.5 origin-bottom transition-transform duration-75 ${
                level >= t * 0.9 ? "bg-signal" : "bg-ink"
              }`}
              style={{
                height: `${25 + i * 25}%`,
                transform: `scaleY(${recording ? Math.min(1, level / t) : 0.15})`
              }}
            />
          ))}
        </div>
      </div>

      {/* Transcript / playback area */}
      <div className="min-h-[140px] p-4">
        {audioUrl && !recording && (
          <div className="mb-4">
            <audio controls src={audioUrl} className="w-full" />
          </div>
        )}
        {finalText || interim ? (
          <p className="text-base leading-relaxed">
            {finalText}
            {interim && <span className="text-fog"> {interim}</span>}
            {recording && <span className="live-caret text-signal">▌</span>}
          </p>
        ) : (
          <p className="text-fog">
            {recording
              ? "Listening… speak your review."
              : audioUrl
              ? speechSupported
                ? "No transcript was captured — the audio still posts fine."
                : "Transcription isn't supported in this browser — audio posts without it."
              : "Press Record and talk. Your actual voice gets posted; the transcript rides along underneath."}
            {recording && <span className="live-caret text-signal">▌</span>}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink p-4">
        {!recording ? (
          <button
            onClick={start}
            className="bg-signal px-5 py-2.5 font-display font-bold uppercase tracking-wide text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            ● {audioUrl ? "Re-record" : "Record"}
          </button>
        ) : (
          <button
            onClick={stop}
            className="border-2 border-ink px-5 py-2.5 font-display font-bold uppercase tracking-wide hover:bg-ink hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            ■ Stop
          </button>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="min-w-[160px] flex-1 border-2 border-ink bg-paper px-3 py-2 text-sm placeholder:text-fog focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />

        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className={`text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                n <= rating ? "text-ink" : "text-fog"
              }`}
            >
              ★
            </button>
          ))}
        </div>

        <button
          onClick={submit}
          disabled={posting || !audioUrl || recording}
          className="ml-auto bg-pine px-5 py-2.5 font-display font-bold uppercase tracking-wide text-paper disabled:opacity-40 hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          {posting ? "Posting…" : "Post review"}
        </button>
      </div>

      {status && (
        <p className="border-t-2 border-ink px-4 py-2 text-sm" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
