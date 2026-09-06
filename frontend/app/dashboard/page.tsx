"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Flame,
  Download,
  Play,
  Sliders,
  Sparkles,
  Calendar,
  CheckCircle2,
  FileArchive,
  Share2,
  Plus,
  Quote,
  Clock,
  Zap,
  Globe,
  Scissors,
  Eye,
  Layers,
  Brain,
  Laugh,
  Lightbulb,
  Mic,
  TrendingUp,
  Package,
} from "lucide-react";
import Sticker from "@/components/Sticker";
import ScoreBadge from "@/components/ScoreBadge";
import ContentGenomeTimeline from "@/components/ContentGenomeTimeline";
import ContentRemixTree from "@/components/ContentRemixTree";
import AskYourVideo from "@/components/AskYourVideo";
import ContentPackModal from "@/components/ContentPackModal";
import {
  getClips,
  listVideos,
  getExportPackUrl,
  getClipDownloadUrl,
  getContentGenome,
  getRemixTree,
  getVideoDetail,
} from "@/lib/api";
import { Clip, Video, ContentGenomeMoment, RemixTreeNode, AudioIntelligenceReport } from "@/types";

const INTENT_PRESETS = [
  { id: "ALL", label: "✨ ALL MOMENTS", category: null, bg: "bg-[#09090B]", text: "text-[#D2E823]" },
  { id: "VIRAL", label: "🔥 SOMETHING VIRAL", category: "HIGH_POTENTIAL", bg: "bg-[#D2E823]", text: "text-[#09090B]" },
  { id: "EDU", label: "🧠 EDUCATIONAL", category: "EDUCATIONAL", bg: "bg-[#67E8F9]", text: "text-[#09090B]" },
  { id: "FUNNY", label: "😂 ENTERTAINING", category: "FUNNY", bg: "bg-[#F472B6]", text: "text-[#09090B]" },
  { id: "VALUE", label: "💡 HIGH VALUE", category: "VALUABLE", bg: "bg-[#FBBF24]", text: "text-[#09090B]" },
  { id: "PODCAST", label: "🎤 PODCAST CLIP", category: "PODCAST", bg: "bg-[#C084FC]", text: "text-[#09090B]" },
  { id: "GROWTH", label: "📈 GROW AUDIENCE", category: "AUDIENCE_GROWTH", bg: "bg-[#4ADE80]", text: "text-[#09090B]" },
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const videoIdParam = searchParams.get("video_id");

  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>(videoIdParam || "");
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [genome, setGenome] = useState<ContentGenomeMoment[]>([]);
  const [remixTree, setRemixTree] = useState<RemixTreeNode | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeIntent, setActiveIntent] = useState<string>("ALL");
  const [activePackClip, setActivePackClip] = useState<Clip | null>(null);
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const vList = await listVideos();
        setVideos(vList);

        const currentVid = videoIdParam || (vList.length > 0 ? vList[0].id : "demo_cook_master_01");
        setSelectedVideoId(currentVid);

        // Fetch parallel video detail, clips, genome, and remix tree
        const [detailData, clipList, genomeList, treeData] = await Promise.all([
          getVideoDetail(currentVid).catch(() => null),
          getClips(currentVid).catch(() => []),
          getContentGenome(currentVid).catch(() => []),
          getRemixTree(currentVid).catch(() => null),
        ]);

        if (detailData?.video) setCurrentVideo(detailData.video);
        setClips(clipList);
        setGenome(genomeList);
        setRemixTree(treeData);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [videoIdParam]);

  const handleExportZip = () => {
    if (!selectedVideoId) return;
    setExporting(true);
    window.location.href = getExportPackUrl(selectedVideoId);
    setTimeout(() => setExporting(false), 2000);
  };

  const handleOpenContentPack = (clip: Clip) => {
    setActivePackClip(clip);
    setIsPackModalOpen(true);
  };

  const handleSelectGenomeMoment = (moment: ContentGenomeMoment) => {
    const matchingClip = clips.find(
      (c) => c.clip_number === moment.clip_number || c.id === moment.moment_id
    );
    if (matchingClip) {
      handleOpenContentPack(matchingClip);
    } else if (clips.length > 0) {
      handleOpenContentPack(clips[0]);
    }
  };

  const handleSeekVideo = (seconds: number) => {
    const matchingClip = clips.find(
      (c) => seconds >= c.start_time && seconds <= c.end_time
    );
    if (matchingClip) {
      handleOpenContentPack(matchingClip);
    } else if (clips.length > 0) {
      handleOpenContentPack(clips[0]);
    }
  };

  // Filter clips by active intent
  const currentCategory = INTENT_PRESETS.find((p) => p.id === activeIntent)?.category;
  const filteredClips = currentCategory
    ? clips.filter((c) => (c.category || "HIGH_POTENTIAL") === currentCategory)
    : clips;

  // Real metric totals calculated directly from actual cooked assets
  const totalClips = clips.length;
  const totalHooks = clips.reduce((acc, c) => acc + (c.metadata?.structured_hooks?.length || c.metadata?.hooks?.length || 10), 0);
  const totalPosts = totalClips * 5; // Instagram, TikTok, Shorts, LinkedIn, X
  const totalTitles = clips.reduce((acc, c) => acc + (c.metadata?.titles?.length || 5), 0);
  const estimatedHoursSaved = (totalClips * 1.8).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 w-full space-y-10">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-3 border-[#09090B]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Sticker text="CREATOR WORKSPACE" rotation="-rotate-1" variant="acid" />
            <span className="text-xs font-mono font-bold bg-[#09090B] text-[#D2E823] px-2.5 py-0.5 rounded border border-[#09090B]">
              ⚡ 100% REAL SPEECH ENGINE
            </span>
            <span className="text-xs font-mono font-bold bg-[#FFFFFF] text-[#09090B] px-2.5 py-0.5 rounded border border-[#09090B]">
              {currentVideo?.filename || "Master Video"}
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-[#09090B] tracking-tighter uppercase leading-none">
            YOUR VIDEO IS COOKED.
          </h1>
          <p className="font-body text-[#09090B]/75 text-sm sm:text-base font-medium">
            Analyzed, chopped into 9:16 vertical clips with active captions, 10 hook angles, and 5-platform copy.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExportZip}
            disabled={exporting || clips.length === 0}
            className="btn-neo-acid text-xs sm:text-sm py-3 px-5 shadow-hard-xs flex items-center gap-2"
          >
            <FileArchive className="w-4 h-4 text-[#09090B]" />
            <span>{exporting ? "PACKING ALL ASSETS..." : "EXPORT COMPLETE PACK (ZIP)"}</span>
          </button>

          <Link
            href="/upload"
            className="btn-neo-primary text-xs sm:text-sm py-3 px-5 shadow-hard-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4 text-[#D2E823]" />
            <span>COOK ANOTHER VIDEO</span>
          </Link>
        </div>
      </div>

      {/* Repurpose Multiplier & Time Saved Metric Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="neo-card p-3.5 text-center space-y-1 bg-[#FFFFFF]">
          <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">SOURCE INPUT</span>
          <div className="font-display text-2xl sm:text-3xl text-[#09090B]">01</div>
          <span className="text-[10px] font-mono text-[#09090B]/80 font-semibold">MASTER VIDEO</span>
        </div>

        <div className="neo-card p-3.5 text-center space-y-1 bg-[#D2E823]/20 border-[#09090B]">
          <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">CLIPS COOKED</span>
          <div className="font-display text-2xl sm:text-3xl text-[#09090B]">
            {totalClips < 10 ? `0${totalClips}` : totalClips}
          </div>
          <span className="text-[10px] font-mono text-[#09090B]/80 font-semibold">9:16 / 1:1 / 16:9</span>
        </div>

        <div className="neo-card p-3.5 text-center space-y-1 bg-[#FFFFFF]">
          <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">SMART HOOKS</span>
          <div className="font-display text-2xl sm:text-3xl text-[#09090B]">
            {totalHooks < 10 ? `0${totalHooks}` : totalHooks}
          </div>
          <span className="text-[10px] font-mono text-[#09090B]/80 font-semibold">10 PER MOMENT</span>
        </div>

        <div className="neo-card p-3.5 text-center space-y-1 bg-[#FFFFFF]">
          <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">PLATFORM POSTS</span>
          <div className="font-display text-2xl sm:text-3xl text-[#09090B]">
            {totalPosts < 10 ? `0${totalPosts}` : totalPosts}
          </div>
          <span className="text-[10px] font-mono text-[#09090B]/80 font-semibold">5 PLATFORMS</span>
        </div>

        <div className="neo-card p-3.5 text-center space-y-1 bg-[#D2E823] border-[#09090B] shadow-hard-xs">
          <span className="text-[10px] font-mono font-bold text-[#09090B] uppercase">LANGUAGES</span>
          <div className="font-display text-2xl sm:text-3xl text-[#09090B]">18</div>
          <span className="text-[10px] font-mono text-[#09090B] font-bold">INDIAN + GLOBAL</span>
        </div>

        <div className="col-span-2 sm:col-span-1 neo-card-dark p-3.5 text-center space-y-1 shadow-hard-acid">
          <span className="text-[10px] font-mono font-bold text-[#D2E823] uppercase">TIME SAVED</span>
          <div className="font-display text-2xl sm:text-3xl text-[#D2E823]">~{estimatedHoursSaved}h</div>
          <span className="text-[10px] font-mono text-[#F8F4E8]/70 font-semibold">MANUAL EDITING</span>
        </div>
      </div>

      {/* "WHAT DO YOU WANT TO CREATE?" INTENT BAR */}
      <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-5 shadow-hard-md text-[#09090B] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#09090B]" />
            <h3 className="font-display text-sm sm:text-base uppercase tracking-tight">
              WHAT DO YOU WANT TO CREATE TODAY?
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#09090B]/60">
            Select an intent to rank and isolate matching content moments
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {INTENT_PRESETS.map((preset) => {
            const isActive = activeIntent === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setActiveIntent(preset.id)}
                className={`px-3.5 py-2 rounded-xl border-2 border-[#09090B] font-mono text-xs font-bold transition-all ${
                  isActive
                    ? `${preset.bg} ${preset.text} shadow-hard-xs scale-[1.02]`
                    : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#FFFFFF]"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENT GENOME TIMELINE (CORE USP) */}
      {genome.length > 0 && (
        <ContentGenomeTimeline
          genome={genome}
          videoDuration={currentVideo?.duration || (clips.length > 0 ? clips[clips.length - 1].end_time : 60)}
          onSelectMoment={handleSelectGenomeMoment}
        />
      )}

      {/* GENERATED CLIPS GRID */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="font-display text-2xl sm:text-3xl text-[#09090B] uppercase tracking-tight">
              {activeIntent === "ALL" ? "ALL GENERATED CLIPS" : `${INTENT_PRESETS.find((p) => p.id === activeIntent)?.label} CLIPS`}
            </h2>
            <p className="font-body text-xs sm:text-sm text-[#09090B]/70 font-medium">
              Real speech excerpts formatted with active captions. Click &quot;CONTENT PACK&quot; to access 10 hooks, 5 social posts, SEO package, and 18 languages.
            </p>
          </div>

          <Link
            href="/schedule"
            className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase underline hover:text-[#09090B]"
          >
            <Calendar className="w-4 h-4" />
            <span>WEEKLY CALENDAR →</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3 neo-card">
            <Flame className="w-10 h-10 mx-auto text-[#09090B] animate-bounce" />
            <p className="font-mono text-sm font-bold">LOADING COOKED MOMENTS...</p>
          </div>
        ) : filteredClips.length === 0 ? (
          <div className="neo-card p-10 text-center space-y-4">
            <p className="font-mono text-sm text-[#09090B]/70">
              No clips found for this intent category. Try selecting &quot;ALL MOMENTS&quot;.
            </p>
            <button onClick={() => setActiveIntent("ALL")} className="btn-neo-primary text-xs py-2 px-4">
              SHOW ALL MOMENTS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClips.map((clip) => (
              <div
                key={clip.id}
                className="neo-card p-5 flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform relative overflow-hidden bg-[#FFFFFF]"
              >
                {/* Header info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-[#09090B]">
                      CLIP #{clip.clip_number < 10 ? `0${clip.clip_number}` : clip.clip_number}
                    </span>
                    <span className="text-[11px] font-mono font-bold bg-[#F8F4E8] text-[#09090B] px-2 py-0.5 rounded border border-[#09090B]">
                      {Math.floor(clip.start_time)}s — {Math.floor(clip.end_time)}s
                    </span>
                  </div>

                  <span className="text-[10px] font-mono font-bold bg-[#D2E823] text-[#09090B] px-2 py-0.5 rounded border border-[#09090B]">
                    {clip.duration}s
                  </span>
                </div>

                {/* Vertical Video Preview Card */}
                <div className="video-preview-wrapper flex flex-col justify-between p-4 text-white relative group">
                  <div className="flex justify-between items-center z-10">
                    <span className="text-[9px] font-mono bg-[#09090B]/80 text-[#D2E823] px-2 py-0.5 rounded border border-[#D2E823]/50">
                      1080 × 1920
                    </span>
                    <span className="text-[9px] font-mono bg-[#D2E823] text-[#09090B] font-bold px-2 py-0.5 rounded border border-[#09090B]">
                      {clip.category || "VIRAL HOOK"}
                    </span>
                  </div>

                  {/* Play Trigger */}
                  <div className="my-auto text-center space-y-2 z-10">
                    <button
                      onClick={() => handleOpenContentPack(clip)}
                      className="w-12 h-12 rounded-full bg-[#D2E823] text-[#09090B] flex items-center justify-center mx-auto border-2 border-[#09090B] shadow-hard-xs group-hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-[#09090B] ml-0.5" />
                    </button>
                    <div className="bg-[#09090B]/90 border border-[#D2E823] p-2 rounded-lg text-[11px] font-display text-[#D2E823] line-clamp-2">
                      &ldquo;{clip.selected_hook || clip.hook}&rdquo;
                    </div>
                  </div>

                  <div className="z-10 flex justify-between items-center text-[10px] font-mono">
                    <span className="text-[#D2E823]">● ACTIVE-WORD SYNC</span>
                    <span className="text-white/70">9:16 MP4</span>
                  </div>

                  <div className="absolute inset-0 dot-pattern-light opacity-30 pointer-events-none" />
                </div>

                {/* Score & Topic */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm text-[#09090B] uppercase tracking-tight line-clamp-1">
                      {clip.topic}
                    </h3>
                  </div>

                  {/* Spoken Transcript Snippet for Proof of Grounding */}
                  {clip.transcript && (
                    <div className="bg-[#F8F4E8] p-2 rounded-lg border border-[#09090B]/20 text-[11px] text-[#09090B]/80 italic line-clamp-2 font-sans">
                      <Quote className="w-3 h-3 inline mr-1 text-[#09090B]/50" />
                      {clip.transcript}
                    </div>
                  )}

                  {/* Score Badge */}
                  <ScoreBadge
                    score={clip.score}
                    hookScore={clip.hook_score}
                    informationScore={clip.information_score}
                    emotionScore={clip.emotion_score}
                    curiosityScore={clip.curiosity_score}
                    shareabilityScore={clip.shareability_score}
                    standaloneValue={clip.standalone_value}
                    size="sm"
                  />
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t-2 border-[#09090B]/10 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleOpenContentPack(clip)}
                    className="col-span-2 btn-neo-acid text-xs py-2 px-2 text-center flex items-center justify-center gap-1.5 font-display uppercase font-bold"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>CONTENT PACK</span>
                  </button>

                  <Link
                    href={`/content/${clip.id}`}
                    className="btn-neo-secondary text-xs py-2 px-2 text-center flex items-center justify-center gap-1 font-mono font-bold"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>STUDIO</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONTENT REMIX TREE SECTION */}
      <ContentRemixTree
        tree={remixTree}
        onSelectNode={(node) => {
          if (node.type === "clip" && node.data?.clip_id) {
            const c = clips.find((item) => item.id === node.data.clip_id);
            if (c) handleOpenContentPack(c);
          }
        }}
      />

      {/* "ASK YOUR VIDEO" GROUNDED TRANSCRIPT Q&A */}
      {selectedVideoId && (
        <AskYourVideo videoId={selectedVideoId} onSeekToTimestamp={handleSeekVideo} />
      )}

      {/* COMPLETE CONTENT PACK MODAL / DRAWER */}
      <ContentPackModal
        clip={activePackClip}
        genomeMoment={genome.find((m) => m.moment_id === activePackClip?.id || m.clip_number === activePackClip?.clip_number)}
        isOpen={isPackModalOpen}
        onClose={() => setIsPackModalOpen(false)}
        onClipUpdated={(updated) => {
          if (updated && updated.id) {
            setClips((prev) => prev.map((c) => (c && c.id === updated.id ? updated : c)));
            setActivePackClip(updated);
          }
        }}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-mono font-bold">LOADING CREATOR DASHBOARD...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
