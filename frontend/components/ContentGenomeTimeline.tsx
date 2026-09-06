"use client";

import React, { useState } from "react";
import { ContentGenomeMoment } from "@/types";
import { Sparkles, Play, Flame, Brain, Laugh, Lightbulb, Mic, TrendingUp, ChevronRight } from "lucide-react";

interface ContentGenomeTimelineProps {
  genome: ContentGenomeMoment[];
  videoDuration: number;
  onSelectMoment: (moment: ContentGenomeMoment) => void;
  selectedMomentId?: string;
}

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: any; bg: string; text: string; border: string }
> = {
  HIGH_POTENTIAL: {
    label: "VIRAL HOOK",
    icon: Flame,
    bg: "bg-[#D2E823]",
    text: "text-[#09090B]",
    border: "border-[#09090B]",
  },
  EDUCATIONAL: {
    label: "EDUCATIONAL",
    icon: Brain,
    bg: "bg-[#67E8F9]",
    text: "text-[#09090B]",
    border: "border-[#09090B]",
  },
  FUNNY: {
    label: "ENTERTAINING",
    icon: Laugh,
    bg: "bg-[#F472B6]",
    text: "text-[#09090B]",
    border: "border-[#09090B]",
  },
  VALUABLE: {
    label: "HIGH VALUE",
    icon: Lightbulb,
    bg: "bg-[#FBBF24]",
    text: "text-[#09090B]",
    border: "border-[#09090B]",
  },
  PODCAST: {
    label: "DEEP CONVERSATION",
    icon: Mic,
    bg: "bg-[#C084FC]",
    text: "text-[#09090B]",
    border: "border-[#09090B]",
  },
  AUDIENCE_GROWTH: {
    label: "AUDIENCE MAGNET",
    icon: TrendingUp,
    bg: "bg-[#4ADE80]",
    text: "text-[#09090B]",
    border: "border-[#09090B]",
  },
};

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ContentGenomeTimeline({
  genome,
  videoDuration,
  onSelectMoment,
  selectedMomentId,
}: ContentGenomeTimelineProps) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [hoveredMoment, setHoveredMoment] = useState<ContentGenomeMoment | null>(null);

  const duration = Math.max(videoDuration || 60, 1);

  const filteredGenome = activeCategoryFilter
    ? genome.filter((m) => m.category === activeCategoryFilter)
    : genome;

  return (
    <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-6 shadow-hard-md text-[#09090B] space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b-2 border-[#09090B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center shadow-hard-xs">
            <Sparkles className="w-5 h-5 text-[#09090B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg tracking-tight uppercase">CONTENT GENOME TIMELINE</h3>
              <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                CORE USP
              </span>
            </div>
            <p className="text-xs font-mono text-[#09090B]/70">
              Interactive map of all detected high-impact moments parsed from real spoken speech.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveCategoryFilter(null)}
            className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border-2 border-[#09090B] transition-all ${
              activeCategoryFilter === null
                ? "bg-[#09090B] text-[#D2E823] shadow-hard-xs"
                : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#eae6d8]"
            }`}
          >
            ALL ({genome.length})
          </button>
          {Object.entries(CATEGORY_MAP).map(([catKey, cat]) => {
            const count = genome.filter((m) => m.category === catKey).length;
            if (count === 0) return null;
            const Icon = cat.icon;
            return (
              <button
                key={catKey}
                onClick={() => setActiveCategoryFilter(activeCategoryFilter === catKey ? null : catKey)}
                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border-2 border-[#09090B] transition-all ${
                  activeCategoryFilter === catKey
                    ? `${cat.bg} ${cat.text} shadow-hard-xs`
                    : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#eae6d8]"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label} ({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Genome Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono font-bold text-[#09090B]/60">
          <span>00:00</span>
          <span>FULL VIDEO DURATION: {formatSeconds(duration)}</span>
          <span>{formatSeconds(duration)}</span>
        </div>

        <div className="relative h-14 w-full bg-[#09090B]/5 rounded-xl border-2 border-[#09090B] overflow-hidden p-1 flex items-center">
          {/* Background grid lines */}
          <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
            <div className="border-r border-[#09090B] h-full w-1/4" />
            <div className="border-r border-[#09090B] h-full w-1/4" />
            <div className="border-r border-[#09090B] h-full w-1/4" />
            <div className="border-r border-[#09090B] h-full w-1/4" />
          </div>

          {genome.map((moment) => {
            const leftPct = Math.min(100, Math.max(0, (moment.start_time / duration) * 100));
            const widthPct = Math.min(100 - leftPct, Math.max(4, (moment.duration / duration) * 100));
            const cat = CATEGORY_MAP[moment.category] || CATEGORY_MAP.HIGH_POTENTIAL;
            const isSelected = selectedMomentId === moment.moment_id;
            const isDimmed = activeCategoryFilter && moment.category !== activeCategoryFilter;

            return (
              <div
                key={moment.moment_id}
                onClick={() => onSelectMoment(moment)}
                onMouseEnter={() => setHoveredMoment(moment)}
                onMouseLeave={() => setHoveredMoment(null)}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                }}
                className={`absolute top-1 bottom-1 rounded-lg border-2 ${cat.border} ${cat.bg} cursor-pointer transition-all duration-150 flex items-center justify-center px-1 font-mono font-bold text-xs ${
                  isSelected ? "ring-4 ring-[#09090B] z-20 scale-y-110 shadow-hard-xs" : "hover:scale-y-105 z-10"
                } ${isDimmed ? "opacity-20 pointer-events-none" : "opacity-100"}`}
              >
                <div className="truncate flex items-center gap-1">
                  <span className="text-[10px] bg-[#09090B] text-[#FFFFFF] px-1 rounded">
                    #{moment.clip_number}
                  </span>
                  <span className="hidden sm:inline text-[10px] truncate">{moment.content_score} pts</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hovered / Quick Moment Preview Card */}
      {hoveredMoment && (
        <div className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex items-start gap-3">
            <div className="px-2 py-1 bg-[#09090B] text-[#D2E823] font-mono font-bold rounded-lg text-xs">
              MOMENT #{hoveredMoment.clip_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm uppercase">{hoveredMoment.title}</span>
                <span className="font-mono text-[10px] text-[#09090B]/60 font-bold">
                  [{formatSeconds(hoveredMoment.start_time)} - {formatSeconds(hoveredMoment.end_time)}]
                </span>
              </div>
              <p className="font-mono text-[11px] text-[#09090B]/80 line-clamp-1 mt-0.5">
                &ldquo;{hoveredMoment.selected_hook || hoveredMoment.transcript}&rdquo;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-[#D2E823] border border-[#09090B] px-2 py-1 rounded-lg font-mono font-bold text-xs">
              SCORE: {hoveredMoment.content_score}/100
            </div>
            <button
              onClick={() => onSelectMoment(hoveredMoment)}
              className="flex items-center gap-1 bg-[#09090B] text-[#F8F4E8] px-3 py-1 rounded-lg font-mono font-bold text-xs hover:bg-[#18181b]"
            >
              <span>INSPECT</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#D2E823]" />
            </button>
          </div>
        </div>
      )}

      {/* Moment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
        {filteredGenome.map((moment) => {
          const cat = CATEGORY_MAP[moment.category] || CATEGORY_MAP.HIGH_POTENTIAL;
          const Icon = cat.icon;
          const isSelected = selectedMomentId === moment.moment_id;

          return (
            <div
              key={moment.moment_id}
              onClick={() => onSelectMoment(moment)}
              className={`border-2 border-[#09090B] rounded-xl p-4 bg-[#F8F4E8] hover:bg-[#FFFFFF] cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                isSelected ? "bg-[#FFFFFF] shadow-hard-md ring-2 ring-[#09090B]" : "shadow-hard-xs hover:shadow-hard-sm"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-[#09090B] text-[10px] font-mono font-bold ${cat.bg} ${cat.text}`}>
                    <Icon className="w-3 h-3" />
                    <span>{cat.label}</span>
                  </div>
                  <span className="font-mono text-xs font-bold bg-[#09090B] text-[#D2E823] px-2 py-0.5 rounded">
                    {moment.content_score} PTS
                  </span>
                </div>

                <h4 className="font-display text-sm uppercase leading-tight line-clamp-2 text-[#09090B]">
                  {moment.title}
                </h4>

                <p className="font-mono text-[11px] text-[#09090B]/70 mt-1 line-clamp-2">
                  {moment.summary || moment.why_this_clip?.opening_hook || moment.transcript}
                </p>
              </div>

              <div className="pt-2 border-t border-[#09090B]/10 flex items-center justify-between text-[11px] font-mono font-bold">
                <span className="text-[#09090B]/60">
                  ⏱ {formatSeconds(moment.start_time)} - {formatSeconds(moment.end_time)} ({Math.round(moment.duration)}s)
                </span>
                <span className="text-[#09090B] underline flex items-center gap-0.5 hover:text-[#4f5207]">
                  PACK <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
