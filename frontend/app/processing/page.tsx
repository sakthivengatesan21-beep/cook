"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Flame, CheckCircle2, Circle, AlertCircle, Sparkles, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import confetti from "canvas-confetti";
import Sticker from "@/components/Sticker";
import { getProcessingStatus, retryProcessing } from "@/lib/api";

function ProcessingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const videoId = searchParams.get("id") || "demo_cook_master_01";

  const [status, setStatus] = useState<string>("extracting_audio");
  const [statusMessage, setStatusMessage] = useState<string>("Extracting audio track with FFmpeg...");
  const [progress, setProgress] = useState<number>(15);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [momentsCount, setMomentsCount] = useState<number>(0);
  const [clipsCount, setClipsCount] = useState<number>(0);
  const [wordCount, setWordCount] = useState<number>(0);

  const steps = [
    { key: "uploaded", label: "VIDEO UPLOADED", threshold: 10 },
    { key: "extracting_audio", label: "AUDIO EXTRACTED", threshold: 20 },
    {
      key: "transcribing",
      label: wordCount > 0 ? `TRANSCRIPT READY (${wordCount} WORDS)` : "TRANSCRIPTION READY",
      threshold: 35
    },
    {
      key: "analyzing",
      label: momentsCount > 0 ? `GOLD FOUND (${momentsCount} MOMENTS)` : "FINDING THE GOLD",
      threshold: 65
    },
    {
      key: "generating_clips",
      label: clipsCount > 0 ? `CHOPPING ${clipsCount} CLIPS (9:16)` : "CHOPPING CLIPS (9:16)",
      threshold: 85
    },
    {
      key: "generating_metadata",
      label: clipsCount > 0 ? `COOKING ${clipsCount * 5} HOOKS & CAPTIONS` : "COOKING HOOKS & CAPTIONS",
      threshold: 95
    },
    { key: "completed", label: "PACKING EVERYTHING UP", threshold: 100 },
  ];

  // Poll real status from backend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let lastUpdatedTimestamp = "";
    let stallCounter = 0;

    const checkStatus = async () => {
      try {
        const res = await getProcessingStatus(videoId);
        setStatus(res.status);
        setStatusMessage(res.status_message || "Processing video...");
        setProgress(res.progress || 10);
        
        if (res.moments_count) setMomentsCount(res.moments_count);
        if (res.clips_count) setClipsCount(res.clips_count);
        if (res.transcript_word_count) setWordCount(res.transcript_word_count);

        // Stale watchdog on frontend
        if (res.status !== "completed" && res.status !== "failed") {
          if (res.updated_at === lastUpdatedTimestamp) {
            stallCounter += 1;
            if (stallCounter >= 60) { // ~2 minutes with 2s poll
              setError("Processing stopped responding. Please click retry to resume.");
            }
          } else {
            lastUpdatedTimestamp = res.updated_at;
            stallCounter = 0;
          }
        }

        if (res.status === "completed") {
          // Trigger victory confetti
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ["#D2E823", "#09090B", "#F8F4E8"],
            });
          } catch {}

          clearInterval(interval);
          setTimeout(() => {
            router.push(`/dashboard?video_id=${videoId}`);
          }, 1200);
        } else if (res.status === "failed") {
          setError(res.error_message || res.status_message || "Processing failed during pipeline.");
          clearInterval(interval);
        }
      } catch (err: any) {
        console.warn("Status check poll error:", err.message);
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2000);

    return () => clearInterval(interval);
  }, [videoId, router]);

  const handleRetry = async () => {
    try {
      setRetrying(true);
      setError(null);
      await retryProcessing(videoId);
      setProgress(10);
      setStatus("uploaded");
      setStatusMessage("Retrying cooking pipeline...");
      // Trigger instant poll
      const res = await getProcessingStatus(videoId);
      setStatus(res.status);
      setProgress(res.progress);
    } catch (err: any) {
      setError(err.message || "Failed to restart processing.");
    } finally {
      setRetrying(false);
    }
  };

  const microcopy = [
    "extracting high-fidelity speech...",
    "finding the good stuff in the transcript...",
    "this one is definitely a banger.",
    "chopping into 9:16 vertical shorts with FFmpeg...",
    "generating scroll-stopping hooks from spoken words...",
    "almost there. plating up your content pack.",
  ];
  const currentMicrocopy = microcopy[Math.min(microcopy.length - 1, Math.floor((progress / 100) * microcopy.length))];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-20 w-full flex flex-col items-center text-center">
      <div className="space-y-4 mb-8">
        <Sticker text="STAGE 02 — COOKING" rotation="-rotate-1" variant="acid" />
        <h1 className="font-display text-4xl sm:text-6xl text-[#09090B] tracking-tighter uppercase leading-tight">
          YOUR CONTENT IS <br />
          <span className="bg-[#D2E823] px-3 border-2 border-[#09090B] shadow-hard-xs inline-block transform rotate-1">
            COOKING...
          </span>
        </h1>
        <p className="font-mono text-sm sm:text-base font-bold text-[#09090B]/70 uppercase tracking-wider">
          {error ? "COOKING INTERRUPTED" : currentMicrocopy}
        </p>
      </div>

      {/* Main Animated Cooking Card */}
      <div className="w-full neo-card p-6 sm:p-10 space-y-8 relative overflow-hidden">
        {/* Animated Cooking Visual */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl ${error ? "bg-red-500" : "bg-[#09090B]"} text-[#D2E823] flex items-center justify-center border-4 border-[#09090B] shadow-hard-md ${error ? "" : "animate-bounce"}`}>
              {error ? (
                <AlertCircle className="w-14 h-14 text-[#FFFFFF]" />
              ) : (
                <Flame className="w-14 h-14 fill-[#D2E823] animate-pulse" />
              )}
            </div>
            <div className={`absolute -bottom-2 -right-2 ${error ? "bg-[#09090B] text-red-400" : "bg-[#D2E823] text-[#09090B]"} p-2 rounded-xl border-2 border-[#09090B] font-display text-xs shadow-hard-xs`}>
              {progress}%
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-2 text-left">
          <div className="flex justify-between items-center text-xs font-mono font-bold">
            <span className="text-[#09090B] uppercase">{statusMessage}</span>
            <span className="font-display text-sm">{progress}%</span>
          </div>
          <div className="h-4 w-full bg-[#09090B]/10 rounded-full border-2 border-[#09090B] overflow-hidden">
            <div
              className={`h-full ${error ? "bg-red-500" : "bg-[#D2E823]"} border-r-2 border-[#09090B] transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step-by-Step State Pipeline */}
        <div className="space-y-2.5 pt-4 text-left border-t-2 border-[#09090B]/20">
          {steps.map((step, idx) => {
            const isDone = progress >= step.threshold;
            const isCurrent = !isDone && (idx === 0 || progress >= steps[idx - 1].threshold);

            return (
              <div
                key={step.key}
                className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between ${
                  isDone
                    ? "bg-[#D2E823]/20 border-[#09090B] text-[#09090B]"
                    : isCurrent
                    ? "bg-[#09090B] border-[#09090B] text-[#D2E823] shadow-hard-xs"
                    : "bg-[#FFFFFF] border-[#09090B]/30 text-[#09090B]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-700 flex-shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-[#D2E823] animate-spin flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 opacity-40 flex-shrink-0" />
                  )}
                  <span className="font-mono text-xs font-bold tracking-wider">
                    {step.label}
                  </span>
                </div>

                <span className="font-mono text-[10px] font-bold">
                  {isDone ? "DONE ✓" : isCurrent ? "COOKING..." : "QUEUED"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error State with prominent Retry */}
        {error && (
          <div className="p-5 bg-red-100 border-2 border-red-500 rounded-xl text-red-950 text-xs font-mono font-bold text-left space-y-3 shadow-hard-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="font-display text-sm tracking-tight text-red-900">
                COOKING FAILED / STOPPED
              </span>
            </div>
            <p className="text-[12px] opacity-90 leading-relaxed font-sans">{error}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="btn-neo-acid text-xs py-2 px-4 flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${retrying ? "animate-spin" : ""}`} />
                <span>{retrying ? "RETRYING..." : "RETRY COOKING"}</span>
              </button>
              <button
                onClick={() => router.push("/upload")}
                className="btn-neo-secondary text-xs py-2 px-4"
              >
                UPLOAD DIFFERENT VIDEO →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-mono font-bold">LOADING COOKING ENGINE...</div>}>
      <ProcessingContent />
    </Suspense>
  );
}
