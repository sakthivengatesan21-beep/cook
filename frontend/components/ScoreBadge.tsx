"use client";

import { useState } from "react";
import { Info, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface ScoreBadgeProps {
  score: number;
  hookScore?: number;
  informationScore?: number;
  emotionScore?: number;
  curiosityScore?: number;
  shareabilityScore?: number;
  standaloneValue?: number;
  showBreakdown?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function ScoreBadge({
  score,
  hookScore = 92,
  informationScore = 90,
  emotionScore = 85,
  curiosityScore = 94,
  shareabilityScore = 91,
  standaloneValue = 95,
  showBreakdown = false,
  size = "md",
}: ScoreBadgeProps) {
  const [expanded, setExpanded] = useState(showBreakdown);

  const breakdownItems = [
    { label: "HOOK STRENGTH", score: hookScore, weight: "25%" },
    { label: "INFORMATION", score: informationScore, weight: "20%" },
    { label: "EMOTIONAL INTEREST", score: emotionScore, weight: "15%" },
    { label: "CURIOSITY", score: curiosityScore, weight: "15%" },
    { label: "SHAREABILITY", score: shareabilityScore, weight: "15%" },
    { label: "STANDALONE VALUE", score: standaloneValue, weight: "10%" },
  ];

  return (
    <div className="flex flex-col gap-2">
      {/* Main Score Pill */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2.5 rounded-xl border-2 border-[#09090B] bg-[#09090B] text-[#F8F4E8] cursor-pointer shadow-hard-xs hover:bg-[#18181b] transition-all select-none ${
          size === "sm"
            ? "px-2.5 py-1 text-xs"
            : size === "lg"
            ? "px-5 py-3 text-base"
            : "px-3.5 py-1.5 text-sm"
        }`}
      >
        <div className="w-2.5 h-2.5 rounded-full bg-[#D2E823] animate-pulse" />
        <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-[#F8F4E8]/80">
          AI CONTENT SCORE
        </span>
        <div className="flex items-baseline gap-0.5 bg-[#D2E823] text-[#09090B] px-2 py-0.5 rounded-md border border-[#09090B] font-display font-bold">
          <span>{score}</span>
          <span className="text-[10px] font-mono opacity-80">/100</span>
        </div>
        <button className="text-[#D2E823] ml-1">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Breakdown Card */}
      {expanded && (
        <div className="bg-[#FFFFFF] border-2 border-[#09090B] rounded-xl p-4 shadow-hard-sm text-[#09090B] flex flex-col gap-3 mt-1 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b-2 border-[#09090B]">
            <div className="flex items-center gap-1.5 font-display text-xs uppercase tracking-tight">
              <Sparkles className="w-3.5 h-3.5 text-[#09090B]" />
              <span>CONTENT SIGNAL BREAKDOWN</span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-[#D2E823] px-1.5 py-0.5 rounded border border-[#09090B]">
              COMPOSITE: {score}
            </span>
          </div>

          <div className="space-y-2">
            {breakdownItems.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between items-center text-[11px] font-mono font-bold">
                  <span className="text-[#09090B]/80">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-[#09090B]/50">({item.weight})</span>
                    <span className="font-bold">{item.score}</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-[#09090B]/10 rounded-full border border-[#09090B] overflow-hidden">
                  <div
                    className="h-full bg-[#D2E823] border-r border-[#09090B] transition-all duration-500"
                    style={{ width: `${item.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#09090B]/20 flex items-start gap-1.5 text-[10px] font-mono text-[#09090B]/70">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#09090B]" />
            <span>AI-generated content signal, not a prediction of virality.</span>
          </div>
        </div>
      )}
    </div>
  );
}
