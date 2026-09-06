"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Flame,
  ArrowRight,
  Sparkles,
  Scissors,
  Subtitles,
  Calendar,
  Share2,
  FileText,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
  Zap,
} from "lucide-react";
import Marquee from "@/components/Marquee";
import Sticker from "@/components/Sticker";
import ScoreBadge from "@/components/ScoreBadge";
import { setupDemoVideo } from "@/lib/api";

export default function LandingPage() {
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(true);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const momentsContainerRef = useRef<HTMLDivElement>(null);

  const handleLaunchDemo = async () => {
    try {
      setLoadingDemo(true);
      const res = await setupDemoVideo();
      if (res.success) {
        router.push(`/processing?id=${res.video_id}`);
      }
    } catch (err) {
      console.error("Demo launch error:", err);
      // If backend not reached yet, route to processing with default demo id
      router.push("/processing?id=demo_cook_master_01");
    } finally {
      setLoadingDemo(false);
    }
  };

  const scrollMoments = (direction: "left" | "right") => {
    if (momentsContainerRef.current) {
      const scrollAmount = direction === "left" ? -340 : 340;
      momentsContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const mockMoments = [
    {
      id: "1",
      number: "01",
      time: "00:00 — 00:09",
      score: 96,
      hook: "Stop wasting 6 hours editing video clips manually.",
      topic: "3-STEP VIRAL HOOK FRAMEWORK",
      tags: ["STRONG HOOK", "HIGH RETENTION", "STANDALONE"],
    },
    {
      id: "2",
      number: "02",
      time: "00:09 — 00:18",
      score: 94,
      hook: "You only have 1.5 seconds before someone swipes away.",
      topic: "THE 1.5 SECOND RETENTION RULE",
      tags: ["PATTERN INTERRUPT", "CURIOSITY GAP", "VIRAL SIGNAL"],
    },
    {
      id: "3",
      number: "03",
      time: "00:18 — 00:27",
      score: 91,
      hook: "Never give away the punchline in the first 5 seconds.",
      topic: "CURIOSITY GAPS & INFORMATION DENSITY",
      tags: ["NARRATIVE TENSION", "HIGH COMPLETION", "ACTIONABLE"],
    },
    {
      id: "4",
      number: "04",
      time: "00:27 — 00:36",
      score: 93,
      hook: "Cut every breath, every pause, and every filler word.",
      topic: "ZERO FLUFF PACING TRICK",
      tags: ["FAST CUTS", "PACING", "TIKTOK READY"],
    },
    {
      id: "5",
      number: "05",
      time: "00:36 — 00:45",
      score: 98,
      hook: "Stop creating new content from scratch every day.",
      topic: "ONE RECORDING → 20+ ASSETS",
      tags: ["MAX LEVERAGE", "HIGH SHAREABILITY", "FOUNDER TIP"],
    },
  ];

  return (
    <div className="flex flex-col items-center w-full min-h-screen">
      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-16 sm:pt-14 sm:pb-24 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-start space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Sticker
                text="AI DOES THE CHOPPING"
                rotation="-rotate-2"
                variant="acid"
                icon={<Flame className="w-3.5 h-3.5 fill-[#09090B]" />}
              />
              <Sticker
                text="GEN-Z CREATOR PIPELINE"
                rotation="rotate-1"
                variant="dark"
              />
            </div>

            {/* Massive Display Heading with Glitch Hover */}
            <h1 className="font-display text-5xl sm:text-7xl lg:text-[5.75rem] leading-[0.88] tracking-tighter text-[#09090B] glitch-hover uppercase">
              ONE VIDEO. <br />
              <span className="text-[#09090B] relative inline-block">
                LET IT{" "}
                <span className="bg-[#D2E823] px-2 border-2 border-[#09090B] shadow-hard-xs inline-block transform -rotate-1">
                  COOK.
                </span>
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="font-body text-base sm:text-xl text-[#09090B]/80 max-w-xl font-medium leading-snug">
              Drop one long-form video. COOK finds the moments worth posting, cuts 9:16 clips, burns subtitles, writes hooks, captions, titles, and hashtags — then serves a full week of ready-to-post content.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto pt-2">
              <Link
                href="/upload"
                className="btn-neo-primary text-base sm:text-lg py-4 px-8 shadow-hard-md flex items-center justify-center gap-3 group"
              >
                <span>LET MY VIDEO COOK</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </Link>

              <button
                onClick={handleLaunchDemo}
                disabled={loadingDemo}
                className="btn-neo-secondary text-sm sm:text-base py-4 px-6 shadow-hard-sm flex items-center justify-center gap-2 border-2 border-[#09090B]"
              >
                <Zap className="w-4 h-4 fill-[#09090B]" />
                <span>{loadingDemo ? "INITIALIZING..." : "TRY 1-CLICK DEMO"}</span>
              </button>
            </div>

            {/* Fact Counters (No Fake Claims) */}
            <div className="pt-4 flex flex-wrap items-center gap-6 sm:gap-10 border-t-2 border-[#09090B]/20 w-full">
              <div className="flex flex-col">
                <span className="font-display text-2xl sm:text-3xl text-[#09090B]">01 UPLOAD</span>
                <span className="text-xs font-mono font-bold text-[#09090B]/60 uppercase">RAW MASTER VIDEO</span>
              </div>
              <span className="font-display text-xl text-[#09090B]">→</span>
              <div className="flex flex-col">
                <span className="font-display text-2xl sm:text-3xl text-[#09090B]">05 SHORTS</span>
                <span className="text-xs font-mono font-bold text-[#09090B]/60 uppercase">9:16 VERTICAL CLIPS</span>
              </div>
              <span className="font-display text-xl text-[#09090B]">→</span>
              <div className="flex flex-col">
                <span className="font-display text-2xl sm:text-3xl text-[#09090B]">15 HOOKS</span>
                <span className="text-xs font-mono font-bold text-[#09090B]/60 uppercase">CUSTOM METADATA</span>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Interactive Creator Video Preview */}
          <div className="lg:col-span-5 relative flex justify-center">
            {/* Main Preview Container */}
            <div className="relative w-full max-w-[340px] sm:max-w-[360px] aspect-[9/16] bg-[#09090B] border-4 border-[#09090B] rounded-[28px] overflow-hidden shadow-hard-xl">
              {/* Simulated High-Contrast Video Content */}
              <div className="absolute inset-0 bg-[#121215] flex flex-col justify-between p-5 text-white">
                {/* Top Overlay Controls */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 bg-[#09090B]/80 backdrop-blur-md px-3 py-1 rounded-full border border-[#D2E823]">
                    <span className="w-2 h-2 rounded-full bg-[#D2E823] animate-ping" />
                    <span className="text-[10px] font-mono font-bold text-[#D2E823]">LIVE PREVIEW</span>
                  </div>
                  <div className="bg-[#09090B] px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border border-white/20 text-[#F8F4E8]">
                    CLIP #01
                  </div>
                </div>

                {/* Center Visual Mockup */}
                <div className="flex flex-col items-center justify-center my-auto space-y-4 text-center z-10">
                  <div className="w-20 h-20 rounded-2xl bg-[#D2E823] text-[#09090B] flex items-center justify-center border-2 border-[#09090B] shadow-hard-xs transform rotate-3">
                    <Flame className="w-10 h-10 fill-[#09090B]" />
                  </div>

                  {/* High Contrast Subtitles Simulation */}
                  <div className="bg-[#09090B] border-2 border-[#D2E823] px-4 py-2.5 rounded-xl shadow-hard-acid-lg max-w-[90%] transform -rotate-1">
                    <p className="font-display text-sm sm:text-base text-[#D2E823] uppercase tracking-tight leading-snug">
                      "STOP WASTING 6 HOURS EDITING SHORTS MANUALLY."
                    </p>
                  </div>
                </div>

                {/* Bottom Stats & Ready State */}
                <div className="space-y-3 z-10">
                  <div className="bg-[#09090B]/90 backdrop-blur-md p-3 rounded-xl border border-white/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-white/70 uppercase">AI CONTENT SCORE</span>
                      <span className="font-display text-sm text-[#D2E823]">96 / 100</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-[#D2E823] w-[96%]" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-[#D2E823] text-[#09090B] p-2.5 rounded-xl font-display text-xs uppercase border border-[#09090B] shadow-hard-xs">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#09090B]" />
                      <span>READY TO POST</span>
                    </div>
                    <span className="font-mono text-[10px] bg-[#09090B] text-[#D2E823] px-2 py-0.5 rounded">
                      00:09
                    </span>
                  </div>
                </div>

                {/* Subtle Grid Lines inside card */}
                <div className="absolute inset-0 dot-pattern-light pointer-events-none opacity-40" />
              </div>
            </div>

            {/* Overlapping Floating Asset Cards */}
            <div className="absolute -top-4 -left-6 sm:-left-10 bg-[#FFFFFF] border-2 border-[#09090B] p-3 rounded-xl shadow-hard-lg animate-float select-none hidden sm:flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D2E823] border border-[#09090B] flex items-center justify-center font-display text-xs">
                05
              </div>
              <div className="flex flex-col">
                <span className="font-display text-xs text-[#09090B]">MOMENTS FOUND</span>
                <span className="text-[9px] font-mono text-[#09090B]/70 font-bold uppercase">100% STANDALONE</span>
              </div>
            </div>

            <div className="absolute -bottom-6 -right-4 sm:-right-8 bg-[#09090B] text-[#D2E823] border-2 border-[#09090B] p-3.5 rounded-xl shadow-hard-acid animate-float-delayed select-none flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#D2E823] animate-ping" />
              <div className="flex flex-col">
                <span className="font-display text-xs uppercase tracking-tight">CONTENT IS COOKING...</span>
                <span className="text-[9px] font-mono text-[#F8F4E8]/70">5 SHORTS + 15 HOOKS</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FULL-WIDTH CONTINUOUS MARQUEE */}
      <Marquee className="my-4" />

      {/* 3. HOW COOK WORKS (4-Step Section) */}
      <section id="how-it-cooks" className="max-w-7xl mx-auto px-4 sm:px-8 py-20 w-full">
        <div className="space-y-4 mb-12 text-center md:text-left">
          <Sticker text="HOW IT COOKS" rotation="-rotate-1" variant="acid" />
          <h2 className="font-display text-4xl sm:text-6xl text-[#09090B] tracking-tighter uppercase">
            FROM RAW VIDEO <br />
            <span className="text-[#09090B]">TO VIRAL PACKET IN 4 STEPS.</span>
          </h2>
          <p className="font-body text-[#09090B]/75 text-base sm:text-lg max-w-2xl">
            No complex timelines. No manual transcription. No staring at a blank caption box.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Step 01 */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-6 hover:-translate-y-1 transition-transform">
            <div className="space-y-4">
              <span className="font-display text-5xl text-[#D2E823] bg-[#09090B] px-3 py-1 rounded-xl border border-[#09090B] inline-block shadow-hard-xs">
                01
              </span>
              <h3 className="font-display text-2xl text-[#09090B] uppercase tracking-tight">
                DROP
              </h3>
              <p className="font-body text-sm text-[#09090B]/80 leading-relaxed font-medium">
                Upload your long-form MP4, MOV, or WEBM podcast, vlog, or stream recording.
              </p>
            </div>
            <div className="p-3 bg-[#F8F4E8] rounded-xl border border-[#09090B] text-xs font-mono font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>DRAG & DROP SUPPORTED</span>
            </div>
          </div>

          {/* Step 02 */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-6 hover:-translate-y-1 transition-transform bg-[#D2E823]/15">
            <div className="space-y-4">
              <span className="font-display text-5xl text-[#09090B] bg-[#D2E823] px-3 py-1 rounded-xl border-2 border-[#09090B] inline-block shadow-hard-xs">
                02
              </span>
              <h3 className="font-display text-2xl text-[#09090B] uppercase tracking-tight">
                FIND
              </h3>
              <p className="font-body text-sm text-[#09090B]/80 leading-relaxed font-medium">
                COOK extracts audio, transcribes every word, and scores moments based on hook strength and retention.
              </p>
            </div>
            <div className="p-3 bg-[#FFFFFF] rounded-xl border border-[#09090B] text-xs font-mono font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#09090B]" />
              <span>AI CONTENT SCORING</span>
            </div>
          </div>

          {/* Step 03 */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-6 hover:-translate-y-1 transition-transform">
            <div className="space-y-4">
              <span className="font-display text-5xl text-[#D2E823] bg-[#09090B] px-3 py-1 rounded-xl border border-[#09090B] inline-block shadow-hard-xs">
                03
              </span>
              <h3 className="font-display text-2xl text-[#09090B] uppercase tracking-tight">
                CHOP
              </h3>
              <p className="font-body text-sm text-[#09090B]/80 leading-relaxed font-medium">
                FFmpeg generates 9:16 vertical video clips, burns subtitles, and generates 3 hook options and captions per clip.
              </p>
            </div>
            <div className="p-3 bg-[#F8F4E8] rounded-xl border border-[#09090B] text-xs font-mono font-bold flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-[#09090B]" />
              <span>1080×1920 AUTO CROP</span>
            </div>
          </div>

          {/* Step 04 */}
          <div className="neo-card-dark p-6 flex flex-col justify-between space-y-6 hover:-translate-y-1 transition-transform shadow-hard-acid">
            <div className="space-y-4">
              <span className="font-display text-5xl text-[#09090B] bg-[#D2E823] px-3 py-1 rounded-xl border-2 border-[#D2E823] inline-block shadow-hard-xs">
                04
              </span>
              <h3 className="font-display text-2xl text-[#D2E823] uppercase tracking-tight">
                POST
              </h3>
              <p className="font-body text-sm text-[#F8F4E8]/80 leading-relaxed font-medium">
                Export the structured content pack ZIP or follow the AI-suggested weekly posting schedule.
              </p>
            </div>
            <div className="p-3 bg-[#18181b] rounded-xl border border-white/20 text-xs font-mono font-bold text-[#D2E823] flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#D2E823]" />
              <span>EXPORT ZIP READY</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FEATURE BENTO GRID */}
      <section id="bento" className="max-w-7xl mx-auto px-4 sm:px-8 py-16 w-full">
        <div className="space-y-4 mb-12 text-center md:text-left">
          <Sticker text="COOK CAPABILITIES" rotation="rotate-1" variant="dark" />
          <h2 className="font-display text-4xl sm:text-6xl text-[#09090B] tracking-tighter uppercase">
            BUILT FOR CREATORS. <br />
            NOT ENTERPRISE SUITS.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Large Dark Bento Card (2 cols, 2 rows on large) */}
          <div className="md:col-span-2 lg:col-span-2 neo-card-dark p-8 flex flex-col justify-between space-y-8 relative overflow-hidden group hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            <div className="space-y-3 z-10">
              <span className="sticker-badge bg-[#D2E823] text-[#09090B]">
                CORE ENGINE
              </span>
              <h3 className="font-display text-3xl sm:text-4xl text-[#F8F4E8] tracking-tight uppercase">
                AI CLIP DETECTION
              </h3>
              <p className="font-body text-sm sm:text-base text-[#F8F4E8]/80 max-w-md">
                Finds the moments people actually want to watch. Analyzes narrative tension, curiosity loops, and standalone clarity.
              </p>
            </div>

            <div className="z-10 bg-[#18181B] p-5 rounded-2xl border-2 border-[#333338] space-y-3">
              <div className="flex items-center justify-between font-mono text-xs text-[#D2E823]">
                <span>● DETECTING HIGH-SIGNAL MOMENTS</span>
                <span>96% CONFIDENCE</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono text-white/80">
                <div className="p-2 bg-[#09090B] rounded border border-white/10 flex justify-between">
                  <span>01:42 - 02:18 The Viral Hook Formula</span>
                  <span className="text-[#D2E823] font-bold">96 SCORE</span>
                </div>
                <div className="p-2 bg-[#09090B] rounded border border-white/10 flex justify-between">
                  <span>08:15 - 08:52 Why Pacing Wins on Reels</span>
                  <span className="text-[#D2E823] font-bold">94 SCORE</span>
                </div>
              </div>
            </div>

            <div className="absolute inset-0 dot-pattern-light opacity-30 pointer-events-none" />
          </div>

          {/* Bento Card: Auto Subtitles */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-4 dot-pattern hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#09090B] text-[#D2E823] flex items-center justify-center border border-[#09090B]">
                <Subtitles className="w-5 h-5" />
              </div>
              <h4 className="font-display text-xl text-[#09090B] uppercase">AUTO SUBTITLES</h4>
              <p className="font-body text-xs text-[#09090B]/80 font-medium leading-relaxed">
                No more manually captioning every clip. High-contrast, yellow-highlighted, hard-burned subtitles.
              </p>
            </div>
            <div className="bg-[#D2E823] p-2.5 rounded-lg border-2 border-[#09090B] text-center font-display text-xs text-[#09090B]">
              BURNED DIRECTLY TO MP4
            </div>
          </div>

          {/* Bento Card: Smart Hooks */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-4 dot-pattern hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#D2E823] text-[#09090B] flex items-center justify-center border border-[#09090B]">
                <Flame className="w-5 h-5 fill-[#09090B]" />
              </div>
              <h4 className="font-display text-xl text-[#09090B] uppercase">SMART HOOKS</h4>
              <p className="font-body text-xs text-[#09090B]/80 font-medium leading-relaxed">
                Turn boring intros into scroll-stopping openings. Get 3 selectable hook variations for every clip.
              </p>
            </div>
            <div className="bg-[#09090B] p-2.5 rounded-lg border-2 border-[#09090B] text-center font-mono text-xs text-[#D2E823] font-bold">
              3 OPTIONS PER CLIP
            </div>
          </div>

          {/* Bento Card: AI Captions */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-4 dot-pattern hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#09090B] text-[#D2E823] flex items-center justify-center border border-[#09090B]">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="font-display text-xl text-[#09090B] uppercase">AI CAPTIONS</h4>
              <p className="font-body text-xs text-[#09090B]/80 font-medium leading-relaxed">
                Captions tailored for Instagram, TikTok, Shorts, and LinkedIn that actually sound like a human.
              </p>
            </div>
            <div className="bg-[#FFFFFF] p-2 rounded-lg border border-[#09090B] text-center font-mono text-[11px] font-bold text-[#09090B]">
              MULTI-PLATFORM READY
            </div>
          </div>

          {/* Bento Card: Content Score */}
          <div className="neo-card p-6 flex flex-col justify-between space-y-4 dot-pattern hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#D2E823] text-[#09090B] flex items-center justify-center border border-[#09090B]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h4 className="font-display text-xl text-[#09090B] uppercase">CONTENT SCORE</h4>
              <p className="font-body text-xs text-[#09090B]/80 font-medium leading-relaxed">
                See which clips have the strongest signals across hook, information density, and shareability.
              </p>
            </div>
            <div className="bg-[#D2E823] p-2 rounded-lg border border-[#09090B] text-center font-mono text-[11px] font-bold text-[#09090B]">
              6 SIGNAL METRICS
            </div>
          </div>

          {/* Bento Card: Posting Schedule */}
          <div className="md:col-span-2 lg:col-span-2 neo-card p-6 flex flex-col justify-between space-y-4 dot-pattern hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all bg-[#D2E823]/10">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#09090B] text-[#D2E823] flex items-center justify-center border border-[#09090B]">
                <Calendar className="w-5 h-5" />
              </div>
              <h4 className="font-display text-xl text-[#09090B] uppercase">POSTING SCHEDULE</h4>
              <p className="font-body text-xs text-[#09090B]/80 font-medium leading-relaxed max-w-md">
                Know exactly what to post on Monday, Tuesday, Wednesday, Thursday, and Friday with AI platform tags.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-mono font-bold">
              <span className="bg-[#09090B] text-[#D2E823] px-2.5 py-1 rounded border border-[#09090B]">MON: REELS</span>
              <span className="bg-[#09090B] text-[#D2E823] px-2.5 py-1 rounded border border-[#09090B]">TUE: SHORTS</span>
              <span className="bg-[#09090B] text-[#D2E823] px-2.5 py-1 rounded border border-[#09090B]">WED: TIKTOK</span>
              <span className="bg-[#09090B] text-[#D2E823] px-2.5 py-1 rounded border border-[#09090B]">THU: LINKEDIN</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. PRODUCT SHOWCASE: "ONE VIDEO. SO MUCH CONTENT." */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-20 w-full">
        <div className="bg-[#09090B] border-4 border-[#09090B] rounded-3xl p-8 sm:p-14 text-[#F8F4E8] shadow-hard-acid-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
            <Sticker text="THE TRANSFORMATION" rotation="-rotate-1" variant="acid" />

            <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl tracking-tighter uppercase leading-[0.9]">
              ONE VIDEO. <br />
              <span className="text-[#D2E823]">SO MUCH CONTENT.</span>
            </h2>

            <div className="inline-flex items-center gap-3 bg-[#18181B] px-5 py-2.5 rounded-full border border-white/20 font-mono text-sm sm:text-base text-[#F8F4E8]">
              <Clock className="w-4 h-4 text-[#D2E823]" />
              <span>45 MINUTE LONG-FORM RECORDING</span>
              <span className="text-[#D2E823]">↓</span>
            </div>

            {/* Giant Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 w-full pt-6">
              <div className="bg-[#121215] border-2 border-[#333338] p-5 rounded-2xl flex flex-col items-center text-center space-y-1 hover:border-[#D2E823] transition-colors">
                <span className="font-display text-4xl sm:text-5xl text-[#D2E823]">05</span>
                <span className="font-display text-xs sm:text-sm uppercase text-[#F8F4E8]">SHORTS</span>
                <span className="text-[10px] font-mono text-white/50">9:16 VERTICAL</span>
              </div>

              <div className="bg-[#121215] border-2 border-[#333338] p-5 rounded-2xl flex flex-col items-center text-center space-y-1 hover:border-[#D2E823] transition-colors">
                <span className="font-display text-4xl sm:text-5xl text-[#D2E823]">15</span>
                <span className="font-display text-xs sm:text-sm uppercase text-[#F8F4E8]">HOOKS</span>
                <span className="text-[10px] font-mono text-white/50">3 PER CLIP</span>
              </div>

              <div className="bg-[#121215] border-2 border-[#333338] p-5 rounded-2xl flex flex-col items-center text-center space-y-1 hover:border-[#D2E823] transition-colors">
                <span className="font-display text-4xl sm:text-5xl text-[#D2E823]">15</span>
                <span className="font-display text-xs sm:text-sm uppercase text-[#F8F4E8]">TITLES</span>
                <span className="text-[10px] font-mono text-white/50">HIGH CTR</span>
              </div>

              <div className="bg-[#121215] border-2 border-[#333338] p-5 rounded-2xl flex flex-col items-center text-center space-y-1 hover:border-[#D2E823] transition-colors">
                <span className="font-display text-4xl sm:text-5xl text-[#D2E823]">05</span>
                <span className="font-display text-xs sm:text-sm uppercase text-[#F8F4E8]">CAPTIONS</span>
                <span className="text-[10px] font-mono text-white/50">MULTI-PLATFORM</span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-[#121215] border-2 border-[#333338] p-5 rounded-2xl flex flex-col items-center text-center space-y-1 hover:border-[#D2E823] transition-colors">
                <span className="font-display text-4xl sm:text-5xl text-[#D2E823]">01</span>
                <span className="font-display text-xs sm:text-sm uppercase text-[#F8F4E8]">CONTENT PLAN</span>
                <span className="text-[10px] font-mono text-white/50">WEEKLY SCHEDULE</span>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/upload" className="btn-neo-acid text-base py-3.5 px-8 shadow-hard-white">
                UPLOAD YOUR VIDEO NOW →
              </Link>
            </div>
          </div>

          <div className="absolute inset-0 dot-pattern-light opacity-30 pointer-events-none" />
        </div>
      </section>

      {/* 6. "BEST MOMENTS" HORIZONTAL SCROLLING SECTION */}
      <section id="moments" className="max-w-7xl mx-auto px-4 sm:px-8 py-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="space-y-2">
            <Sticker text="AI-SELECTED CLIPS" rotation="-rotate-1" variant="acid" />
            <h2 className="font-display text-4xl sm:text-5xl text-[#09090B] tracking-tighter uppercase">
              BEST MOMENTS
            </h2>
            <p className="font-body text-[#09090B]/70 text-sm">
              COOK found these high-retention moments from raw recordings.
            </p>
          </div>

          {/* Scroll navigation arrows */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollMoments("left")}
              className="p-3 rounded-xl border-2 border-[#09090B] bg-white shadow-hard-xs hover:bg-[#D2E823] transition-colors"
              aria-label="Previous moments"
            >
              <ChevronLeft className="w-5 h-5 text-[#09090B]" />
            </button>
            <button
              onClick={() => scrollMoments("right")}
              className="p-3 rounded-xl border-2 border-[#09090B] bg-white shadow-hard-xs hover:bg-[#D2E823] transition-colors"
              aria-label="Next moments"
            >
              <ChevronRight className="w-5 h-5 text-[#09090B]" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Flex Container (320px wide cards) */}
        <div
          ref={momentsContainerRef}
          className="flex items-stretch gap-6 overflow-x-auto no-scrollbar pb-6 pt-2 scroll-smooth"
        >
          {mockMoments.map((item) => (
            <div
              key={item.id}
              className="w-[320px] flex-shrink-0 neo-card p-5 flex flex-col justify-between space-y-4 hover:-translate-y-1.5 transition-transform"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg text-[#09090B]">#{item.number}</span>
                  <span className="font-mono text-xs text-[#09090B]/60 font-bold">{item.time}</span>
                </div>
                <span className="bg-[#D2E823] text-[#09090B] font-display text-xs px-2.5 py-0.5 rounded border border-[#09090B]">
                  {item.score} SCORE
                </span>
              </div>

              {/* Vertical Video Preview Mock */}
              <div className="video-preview-wrapper flex flex-col justify-between p-4 text-white">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-[#D2E823]">9:16 VERTICAL</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded">AUTO SUBTITLE</span>
                </div>

                <div className="my-auto text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-[#D2E823] text-[#09090B] flex items-center justify-center mx-auto border border-[#09090B] shadow-hard-xs">
                    <Play className="w-5 h-5 fill-[#09090B] ml-0.5" />
                  </div>
                  <div className="bg-[#09090B] border border-[#D2E823] p-2 rounded-lg text-[11px] font-display text-[#D2E823]">
                    "{item.hook}"
                  </div>
                </div>

                <div className="text-[10px] font-mono text-white/70 text-center">
                  READY TO EXPORT
                </div>
              </div>

              {/* Topic & Tags */}
              <div className="space-y-2">
                <h4 className="font-display text-xs text-[#09090B] uppercase tracking-tight line-clamp-1">
                  {item.topic}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[9px] font-mono font-bold bg-[#F8F4E8] text-[#09090B] px-2 py-0.5 rounded border border-[#09090B]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#09090B]/10 flex items-center gap-2">
                <Link
                  href={`/content/${item.id}`}
                  className="btn-neo-secondary text-xs py-2 px-3 flex-1 text-center font-display"
                >
                  PREVIEW / EDIT
                </Link>
                <Link
                  href="/upload"
                  className="btn-neo-primary text-xs py-2 px-3 text-center"
                >
                  COOK
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
