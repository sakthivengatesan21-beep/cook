"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getEdits, API_BASE } from "@/lib/api";
import { Film, Download, Trash2, Edit3, Play, Clock, Sparkles, RefreshCw, ExternalLink } from "lucide-react";

export default function MyEditsPage() {
  const { user } = useAuth();
  const [edits, setEdits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getEdits();
      setEdits(data);
    } catch (e) {
      console.error("Failed to load edited videos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b-2 border-[#09090B] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D2E823] border border-[#09090B] text-xs font-mono font-bold uppercase tracking-wider mb-2 shadow-hard-xs">
            <Film className="w-3.5 h-3.5" />
            <span>VERSIONED EDITS</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#09090B] tracking-tight">
            MY EDITED VIDEOS
          </h1>
          <p className="text-sm font-mono text-[#09090B]/60 mt-1">
            Every rendered vertical clip with burned subtitles, version history, and custom styling.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2.5 rounded-lg border-2 border-[#09090B] bg-white hover:bg-[#D2E823] text-[#09090B] shadow-hard-xs transition-colors self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-neo p-6 animate-pulse h-80 bg-white/50" />
          ))}
        </div>
      ) : edits.length === 0 ? (
        <div className="card-neo p-12 text-center bg-[#F8F4E8]">
          <div className="w-16 h-16 rounded-2xl bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center mx-auto mb-4 shadow-hard-xs">
            <Film className="w-8 h-8 text-[#09090B]" />
          </div>
          <h2 className="text-xl font-display font-bold text-[#09090B] mb-2">No edited versions yet</h2>
          <p className="text-sm font-mono text-[#09090B]/60 max-w-md mx-auto mb-6">
            When you process videos and customize captions in the Caption Studio, all rendered versions (v1, v2) will appear here.
          </p>
          <Link href="/upload" className="btn-neo-primary py-3 px-6 shadow-hard-xs inline-flex items-center gap-2">
            <span>START COOKING</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {edits.map((item, idx) => {
            const videoUrl = item.storage_path.startsWith("http")
              ? item.storage_path
              : `${API_BASE}/outputs/${item.storage_path.split("/").pop()}`;

            return (
              <div
                key={item.id || idx}
                className="card-neo p-4 flex flex-col justify-between bg-white group hover:-translate-y-1 transition-all duration-200"
              >
                {/* Video Preview Card */}
                <div className="relative aspect-[9/16] max-h-72 w-full bg-black rounded-xl overflow-hidden mb-4 border border-[#09090B]">
                  <video
                    src={videoUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#09090B]/80 text-[#D2E823] font-mono text-[10px] font-bold border border-[#D2E823]/40">
                    VERSION v{item.version || 1}
                  </div>
                </div>

                {/* Details */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-[#09090B] bg-[#D2E823]/30 px-2 py-0.5 rounded border border-[#09090B]/20">
                      STYLE: {item.caption_style || "ACID"}
                    </span>
                    <span className="text-[11px] font-mono text-gray-500">
                      {Math.round(item.duration_seconds || 0)}s
                    </span>
                  </div>

                  <p className="text-xs font-mono text-gray-500 mb-4 line-clamp-1">
                    Clip ID: {item.clip_id || "clip_master"}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[#09090B]/10 flex items-center justify-between gap-2">
                  <Link
                    href={`/dashboard?id=${item.video_id}`}
                    className="btn-neo-secondary text-xs py-1.5 px-3 flex-1 text-center"
                  >
                    CAPTION STUDIO
                  </Link>
                  <a
                    href={videoUrl}
                    download={`clip_${item.clip_id}_v${item.version}.mp4`}
                    className="p-2 rounded-lg border-2 border-[#09090B] bg-white hover:bg-[#D2E823] text-[#09090B] transition-colors"
                    title="Export / Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
