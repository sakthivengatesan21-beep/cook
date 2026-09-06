"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  Clock,
  Share2,
  ExternalLink,
  Download,
  Flame,
  CheckCircle2,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  X,
  Sliders,
} from "lucide-react";
import Sticker from "@/components/Sticker";
import { getVideoDetail, listVideos, getExportPackUrl, updateScheduleItem, getClipDownloadUrl } from "@/lib/api";
import { ScheduleItem } from "@/types";

const STATUS_PILLS: Record<string, { label: string; bg: string; text: string }> = {
  IDEA: { label: "IDEA", bg: "bg-[#F8F4E8]", text: "text-[#09090B]" },
  READY: { label: "READY", bg: "bg-[#67E8F9]", text: "text-[#09090B]" },
  SCHEDULED: { label: "SCHEDULED", bg: "bg-[#D2E823]", text: "text-[#09090B]" },
  POSTED: { label: "POSTED", bg: "bg-emerald-400", text: "text-[#09090B]" },
};

const PLATFORM_URLS: Record<string, string> = {
  "Instagram Reels": "https://www.instagram.com",
  "YouTube Shorts": "https://studio.youtube.com",
  "TikTok": "https://www.tiktok.com/creator-center/upload",
  "LinkedIn": "https://www.linkedin.com/feed",
  "X (Twitter)": "https://x.com/compose/post",
};

function ScheduleContent() {
  const searchParams = useSearchParams();
  const videoIdParam = searchParams.get("video_id");

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideoId, setActiveVideoId] = useState<string>(videoIdParam || "demo_cook_master_01");
  const [activePublishItem, setActivePublishItem] = useState<ScheduleItem | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadSchedule() {
      try {
        setLoading(true);
        const vList = await listVideos();
        const vId = videoIdParam || (vList.length > 0 ? vList[0].id : "demo_cook_master_01");
        setActiveVideoId(vId);

        const res = await getVideoDetail(vId);
        if (res && res.schedule && res.schedule.length > 0) {
          setSchedule(res.schedule);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSchedule();
  }, [videoIdParam]);

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      await updateScheduleItem(itemId, { status: newStatus });
      setSchedule((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item))
      );
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleCopyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformBadgeColor: Record<string, string> = {
    "Instagram Reels": "bg-pink-100 text-pink-900 border-pink-900",
    "YouTube Shorts": "bg-red-100 text-red-900 border-red-900",
    "TikTok": "bg-sky-100 text-sky-900 border-sky-900",
    "LinkedIn": "bg-blue-100 text-blue-900 border-blue-900",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-14 w-full space-y-10 text-[#09090B]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-3 border-[#09090B]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sticker text="WEEKLY CADENCE" rotation="-rotate-1" variant="acid" />
            <span className="text-xs font-mono font-bold bg-[#09090B] text-[#D2E823] px-2.5 py-0.5 rounded border border-[#09090B]">
              AUTO-SCHEDULED
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl tracking-tighter uppercase leading-none">
            CONTENT CALENDAR.
          </h1>
          <p className="font-body text-[#09090B]/75 text-base sm:text-lg font-medium">
            Structured publishing plan. Track statuses (Idea $\rightarrow$ Ready $\rightarrow$ Scheduled $\rightarrow$ Posted) and publish directly.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={getExportPackUrl(activeVideoId)}
            className="btn-neo-acid text-xs sm:text-sm py-3 px-5 shadow-hard-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-[#09090B]" />
            <span>DOWNLOAD SCHEDULE (CSV)</span>
          </a>

          <Link
            href="/upload"
            className="btn-neo-primary text-xs sm:text-sm py-3 px-5 shadow-hard-xs flex items-center gap-2"
          >
            <Flame className="w-4 h-4 text-[#D2E823]" />
            <span>COOK NEW CLIPS</span>
          </Link>
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="space-y-4">
        {loading ? (
          <div className="neo-card p-12 text-center space-y-3">
            <Sparkles className="w-8 h-8 mx-auto animate-spin text-[#09090B]" />
            <p className="font-mono text-xs font-bold">LOADING PUBLISHING PLAN...</p>
          </div>
        ) : schedule.length === 0 ? (
          <div className="neo-card p-12 text-center space-y-4">
            <Calendar className="w-12 h-12 mx-auto opacity-40" />
            <p className="font-mono text-xs text-[#09090B]/70">No scheduled content. Cook a video to generate your plan.</p>
          </div>
        ) : (
          schedule.map((item) => {
            const currentStatus = item.status || "SCHEDULED";
            const pill = STATUS_PILLS[currentStatus] || STATUS_PILLS.SCHEDULED;

            return (
              <div
                key={item.id}
                className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-5 shadow-hard-sm hover:shadow-hard-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left: Timing & Platform */}
                <div className="flex items-start sm:items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#D2E823] border-2 border-[#09090B] flex flex-col items-center justify-center font-mono font-bold shadow-hard-xs flex-shrink-0">
                    <span className="text-[10px] leading-tight text-[#09090B]/70 uppercase">
                      {item.day_of_week.substring(0, 3)}
                    </span>
                    <span className="text-sm font-display text-[#09090B]">#{item.clip_number}</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border-2 ${
                          platformBadgeColor[item.platform] || "bg-[#F8F4E8] text-[#09090B] border-[#09090B]"
                        }`}
                      >
                        {item.platform}
                      </span>

                      <span className="flex items-center gap-1 text-[11px] font-mono text-[#09090B]/70 font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {item.scheduled_date} @ {item.scheduled_time}
                        </span>
                      </span>
                    </div>

                    <p className="font-display text-sm uppercase text-[#09090B] line-clamp-1">
                      &ldquo;{item.hook_preview}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Right: Status Switcher & Publish Action */}
                <div className="flex flex-wrap items-center gap-3 pt-3 lg:pt-0 border-t-2 lg:border-t-0 border-[#09090B]/10">
                  {/* Status Dropdown / Pills */}
                  <div className="flex items-center gap-1 bg-[#F8F4E8] p-1 rounded-xl border border-[#09090B]">
                    {Object.keys(STATUS_PILLS).map((st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(item.id, st)}
                        className={`px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                          currentStatus === st
                            ? `${STATUS_PILLS[st].bg} text-[#09090B] border border-[#09090B] shadow-hard-xs font-bold`
                            : "text-[#09090B]/60 hover:text-[#09090B]"
                        }`}
                      >
                        {STATUS_PILLS[st].label}
                      </button>
                    ))}
                  </div>

                  {/* Publish Helper Button */}
                  <button
                    onClick={() => setActivePublishItem(item)}
                    className="btn-neo-acid text-xs py-2 px-3 font-mono font-bold flex items-center gap-1.5 shadow-hard-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>PUBLISH HELPER</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Social Publishing Drawer / Modal */}
      {activePublishItem && (
        <div className="fixed inset-0 z-50 bg-[#09090B]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border-4 border-[#09090B] rounded-3xl p-6 max-w-lg w-full shadow-hard-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#09090B]">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#09090B]" />
                <span className="font-display text-base uppercase">
                  PUBLISH TO {activePublishItem.platform.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setActivePublishItem(null)}
                className="font-display text-lg p-1 hover:text-red-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-[#F8F4E8] p-3 rounded-xl border border-[#09090B] space-y-1">
                <span className="text-[10px] font-bold text-[#09090B]/60 uppercase">HOOK & CAPTION:</span>
                <p className="font-bold text-[#09090B]">&ldquo;{activePublishItem.hook_preview}&rdquo;</p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => handleCopyCaption(activePublishItem.hook_preview)}
                  className="w-full bg-[#FFFFFF] hover:bg-[#D2E823] border-2 border-[#09090B] py-2.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-hard-xs transition-all"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "CAPTION COPIED!" : "1. COPY POST CAPTION"}</span>
                </button>

                <a
                  href={getClipDownloadUrl(activePublishItem.clip_id, "captioned")}
                  download
                  className="w-full bg-[#09090B] hover:bg-[#18181b] text-[#D2E823] border-2 border-[#09090B] py-2.5 rounded-xl font-display text-xs uppercase font-bold flex items-center justify-center gap-2 shadow-hard-xs transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>2. DOWNLOAD 9:16 CAPTIONED VIDEO</span>
                </a>

                <a
                  href={PLATFORM_URLS[activePublishItem.platform] || "https://instagram.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#D2E823] hover:bg-[#b8cb1e] text-[#09090B] border-2 border-[#09090B] py-2.5 rounded-xl font-display text-xs uppercase font-bold flex items-center justify-center gap-2 shadow-hard-xs transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>3. OPEN {activePublishItem.platform.toUpperCase()} IN NEW TAB ↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-mono font-bold">LOADING SCHEDULE...</div>}>
      <ScheduleContent />
    </Suspense>
  );
}
