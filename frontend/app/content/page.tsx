"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getLibrary, deleteVideo, API_BASE } from "@/lib/api";
import { Video, Sparkles, Clock, Trash2, ArrowRight, Film, Hash, MessageSquare, Play, Plus, RefreshCw } from "lucide-react";

export default function MyContentPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getLibrary();
      setItems(data);
    } catch (e) {
      console.error("Failed to load library:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDelete = async (videoId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this video and all associated clips, transcripts, and storage assets?")) {
      return;
    }
    setDeletingId(videoId);
    try {
      await deleteVideo(videoId);
      setItems(items.filter((item) => item.id !== videoId));
    } catch (err) {
      alert("Failed to delete video: " + (err as any).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b-2 border-[#09090B] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D2E823] border border-[#09090B] text-xs font-mono font-bold uppercase tracking-wider mb-2 shadow-hard-xs">
            <Video className="w-3.5 h-3.5" />
            <span>SUPABASE PERSISTENCE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#09090B] tracking-tight">
            MY CONTENT LIBRARY
          </h1>
          <p className="text-sm font-mono text-[#09090B]/60 mt-1">
            All your processed master videos, detected standout moments, and generated short-form clips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-lg border-2 border-[#09090B] bg-white hover:bg-[#D2E823] text-[#09090B] shadow-hard-xs transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/upload"
            className="btn-neo-primary text-xs py-2.5 px-5 shadow-hard-xs flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>NEW VIDEO</span>
          </Link>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-neo p-6 animate-pulse h-64 bg-white/50" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card-neo p-12 text-center bg-[#F8F4E8]">
          <div className="w-16 h-16 rounded-2xl bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center mx-auto mb-4 shadow-hard-xs">
            <Video className="w-8 h-8 text-[#09090B]" />
          </div>
          <h2 className="text-xl font-display font-bold text-[#09090B] mb-2">No videos yet</h2>
          <p className="text-sm font-mono text-[#09090B]/60 max-w-md mx-auto mb-6">
            Upload your first long-form video or podcast. COOK will extract standout moments, 9:16 clips, and active-word subtitles.
          </p>
          <Link href="/upload" className="btn-neo-primary py-3 px-6 shadow-hard-xs inline-flex items-center gap-2">
            <span>UPLOAD YOUR FIRST VIDEO</span>
            <span>→</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const isCompleted = item.status === "completed";
            return (
              <div
                key={item.id}
                className="card-neo p-5 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-200 bg-white"
              >
                <div>
                  {/* Status & Actions Header */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isCompleted
                          ? "bg-green-100 text-green-800 border-green-400"
                          : item.status === "failed"
                          ? "bg-red-100 text-red-800 border-red-400"
                          : "bg-amber-100 text-amber-800 border-amber-400 animate-pulse"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Video & Assets"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="font-display font-bold text-lg text-[#09090B] line-clamp-2 mb-2 group-hover:text-[#FF5500] transition-colors">
                    {item.filename}
                  </h3>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#09090B]/70 mb-4">
                    <span className="flex items-center gap-1 bg-[#F8F4E8] px-2 py-0.5 rounded border border-[#09090B]/20">
                      <Clock className="w-3 h-3 text-[#09090B]" />
                      <span>{Math.round(item.duration)}s</span>
                    </span>
                    <span className="flex items-center gap-1 bg-[#D2E823]/30 px-2 py-0.5 rounded border border-[#09090B]/20 font-bold">
                      <Film className="w-3 h-3 text-[#09090B]" />
                      <span>{item.clips_count} Clips</span>
                    </span>
                    <span className="flex items-center gap-1 bg-[#F8F4E8] px-2 py-0.5 rounded border border-[#09090B]/20">
                      <MessageSquare className="w-3 h-3 text-[#09090B]" />
                      <span>{item.hooks_count} Hooks</span>
                    </span>
                  </div>
                </div>

                {/* Footer Action Link */}
                <div className="pt-4 border-t border-[#09090B]/10 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-gray-400">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}
                  </span>
                  <Link
                    href={isCompleted ? `/dashboard?id=${item.id}` : `/processing?id=${item.id}`}
                    className="btn-neo-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <span>{isCompleted ? "VIEW CLIPS" : "CHECK STATUS"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
