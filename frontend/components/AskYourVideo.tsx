"use client";

import React, { useState } from "react";
import { askVideo, searchVideo } from "@/lib/api";
import { AskVideoResponse, AskVideoTimestamp } from "@/types";
import { MessageSquare, Search, Sparkles, Send, Play, Clock, CheckCircle2, Loader2, HelpCircle } from "lucide-react";

interface AskYourVideoProps {
  videoId: string;
  onSeekToTimestamp?: (seconds: number) => void;
}

const SUGGESTED_QUESTIONS = [
  "What is the most actionable advice in this video?",
  "Where is the best hook for a short clip?",
  "Summarize the core premise in 2 sentences",
  "What are the main mistakes or warnings mentioned?",
];

export default function AskYourVideo({ videoId, onSeekToTimestamp }: AskYourVideoProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<"ask" | "search">("ask");
  const [chatHistory, setChatHistory] = useState<Array<{
    type: "user" | "ai";
    text: string;
    timestamps?: AskVideoTimestamp[];
    confidence?: number;
  }>>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleAsk = async (textToAsk?: string) => {
    const q = textToAsk || query;
    if (!q.trim() || loading) return;

    setLoading(true);
    setChatHistory((prev) => [...prev, { type: "user", text: q }]);
    if (!textToAsk) setQuery("");

    try {
      if (searchMode === "ask") {
        const response: AskVideoResponse = await askVideo(videoId, q);
        setChatHistory((prev) => [
          ...prev,
          {
            type: "ai",
            text: response.answer,
            timestamps: response.relevant_timestamps,
            confidence: response.confidence,
          },
        ]);
      } else {
        const results = await searchVideo(videoId, q);
        setSearchResults(results);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          type: "ai",
          text: `Error analyzing video transcript: ${err.message || "Please try asking a different question."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleTimestampClick = (seconds: number) => {
    if (onSeekToTimestamp) {
      onSeekToTimestamp(seconds);
    }
  };

  return (
    <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-6 shadow-hard-md text-[#09090B] space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b-2 border-[#09090B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center shadow-hard-xs">
            <MessageSquare className="w-5 h-5 text-[#09090B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg tracking-tight uppercase">ASK YOUR VIDEO</h3>
              <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                GROUNDED AI
              </span>
            </div>
            <p className="text-xs font-mono text-[#09090B]/70">
              Direct transcript intelligence. Ask questions, extract takeaways, and jump directly to exact spoken timestamps.
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-1 bg-[#F8F4E8] p-1 rounded-xl border-2 border-[#09090B]">
          <button
            onClick={() => setSearchMode("ask")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
              searchMode === "ask" ? "bg-[#09090B] text-[#D2E823] shadow-hard-xs" : "text-[#09090B]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Q&A</span>
          </button>
          <button
            onClick={() => setSearchMode("search")}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
              searchMode === "search" ? "bg-[#09090B] text-[#D2E823] shadow-hard-xs" : "text-[#09090B]"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>EXACT SEARCH</span>
          </button>
        </div>
      </div>

      {/* Suggested Questions Pills */}
      {chatHistory.length === 0 && searchResults.length === 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-[11px] font-mono font-bold text-[#09090B]/60 uppercase flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            TRY ASKING:
          </span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleAsk(q)}
                className="bg-[#F8F4E8] hover:bg-[#D2E823] border-2 border-[#09090B] text-xs font-mono font-bold px-3 py-1.5 rounded-xl text-left transition-all shadow-hard-xs hover:shadow-hard-sm"
              >
                &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results / Conversation View */}
      <div className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-4 min-h-[160px] max-h-[380px] overflow-y-auto space-y-3">
        {chatHistory.length === 0 && searchResults.length === 0 && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#09090B]/50 font-mono text-xs">
            <MessageSquare className="w-8 h-8 mb-2 opacity-40 text-[#09090B]" />
            Ask anything about your video. Answers are strictly grounded in your video&apos;s audio and transcript.
          </div>
        )}

        {searchMode === "ask" &&
          chatHistory.map((item, idx) => (
            <div
              key={idx}
              className={`flex flex-col gap-1.5 ${item.type === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-3.5 border-2 border-[#09090B] text-xs font-mono ${
                  item.type === "user"
                    ? "bg-[#09090B] text-[#D2E823] shadow-hard-xs"
                    : "bg-[#FFFFFF] text-[#09090B] shadow-hard-xs space-y-2"
                }`}
              >
                <div className="whitespace-pre-wrap">{item.text}</div>

                {/* Timestamps / Jump Links */}
                {item.timestamps && item.timestamps.length > 0 && (
                  <div className="pt-2 border-t border-[#09090B]/10 space-y-1.5">
                    <span className="text-[10px] font-bold text-[#09090B]/60 uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#09090B]" />
                      CLICKABLE SPOKEN MOMENTS:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.timestamps.map((ts, tIdx) => (
                        <button
                          key={tIdx}
                          onClick={() => handleTimestampClick(ts.seconds)}
                          className="flex items-center gap-1 bg-[#D2E823] hover:bg-[#b8cb1e] text-[#09090B] border border-[#09090B] px-2 py-0.5 rounded font-bold text-[10px] transition-all"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>[{ts.timestamp}]</span>
                          <span className="truncate max-w-[140px] opacity-80">&ldquo;{ts.quote}&rdquo;</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

        {searchMode === "search" && searchResults.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold text-[#09090B]/70 uppercase">
              FOUND {searchResults.length} TRANSCRIPT MATCHES:
            </span>
            {searchResults.map((res, sIdx) => (
              <div
                key={sIdx}
                onClick={() => handleTimestampClick(res.start)}
                className="bg-[#FFFFFF] border-2 border-[#09090B] rounded-xl p-3 cursor-pointer hover:bg-[#D2E823]/20 transition-all flex items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="bg-[#09090B] text-[#D2E823] px-2 py-0.5 rounded font-bold text-[10px]">
                    {res.timestamp || "00:00"}
                  </span>
                  <span className="text-[#09090B]">&ldquo;{res.text}&rdquo;</span>
                </div>
                <Play className="w-4 h-4 text-[#09090B] flex-shrink-0" />
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#09090B] bg-[#FFFFFF] border-2 border-[#09090B] rounded-xl p-3 shadow-hard-xs w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-[#09090B]" />
            <span>Scanning spoken speech and analyzing transcript context...</span>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder={
              searchMode === "ask"
                ? "Ask anything about this video (e.g., 'What was the conclusion?')..."
                : "Type keyword to find exact timestamp in spoken dialogue..."
            }
            className="w-full bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl px-4 py-2.5 text-xs font-mono text-[#09090B] placeholder:text-[#09090B]/40 focus:outline-none focus:ring-2 focus:ring-[#D2E823] shadow-hard-xs"
          />
        </div>
        <button
          onClick={() => handleAsk()}
          disabled={loading || !query.trim()}
          className="bg-[#D2E823] hover:bg-[#b8cb1e] text-[#09090B] border-2 border-[#09090B] rounded-xl px-4 py-2.5 font-display text-xs uppercase font-bold flex items-center gap-1.5 shadow-hard-xs hover:shadow-hard-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span className="hidden sm:inline">SUBMIT</span>
        </button>
      </div>
    </div>
  );
}
