"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Lightbulb,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Tag,
  ArrowRight,
  Flame,
  Check,
  Copy,
  Layers,
  Send,
} from "lucide-react";
import Sticker from "@/components/Sticker";
import { getIdeas, createIdea, deleteIdea, generateIdeaAngles } from "@/lib/api";
import { IdeaItem } from "@/types";

const PLATFORMS = [
  { id: "all", label: "ALL PLATFORMS" },
  { id: "youtube", label: "YOUTUBE" },
  { id: "instagram", label: "INSTAGRAM" },
  { id: "tiktok", label: "TIKTOK" },
  { id: "linkedin", label: "LINKEDIN" },
  { id: "x", label: "𝕏 (TWITTER)" },
];

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatformFilter, setActivePlatformFilter] = useState("all");

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("general");
  const [newNotes, setNewNotes] = useState("");
  const [newTags, setNewTags] = useState("inspiration, hook");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      setLoading(true);
      const data = await getIdeas();
      setIdeas(data);
    } catch (err) {
      console.error("Failed to load ideas", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    try {
      setCreating(true);
      const tagList = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await createIdea({
        title: newTitle.trim(),
        url: newUrl.trim(),
        platform: newPlatform,
        notes: newNotes.trim(),
        tags: tagList,
      });

      setIdeas((prev) => [created, ...prev]);
      setNewTitle("");
      setNewUrl("");
      setNewNotes("");
      setNewTags("inspiration, hook");
    } catch (err: any) {
      alert(`Failed to save idea: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteIdea = async (id: string) => {
    if (!confirm("Are you sure you want to delete this idea?")) return;
    try {
      await deleteIdea(id);
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredIdeas =
    activePlatformFilter === "all"
      ? ideas
      : ideas.filter((i) => (i.platform || "general").toLowerCase() === activePlatformFilter.toLowerCase());

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 w-full space-y-10 text-[#09090B]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b-3 border-[#09090B]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sticker text="INSPIRATION & HOOKS" rotation="-rotate-1" variant="acid" />
            <span className="text-xs font-mono font-bold bg-[#09090B] text-[#D2E823] px-2.5 py-0.5 rounded border border-[#09090B]">
              CHROME EXTENSION SYNCED
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl tracking-tighter uppercase leading-none">
            CREATOR IDEA BANK.
          </h1>
          <p className="font-body text-[#09090B]/75 text-base sm:text-lg font-medium">
            Capture inspiration from YouTube, TikTok, LinkedIn, or the web. Generate hook angles and cook into full video assets.
          </p>
        </div>

        <Link
          href="/upload"
          className="btn-neo-acid text-sm py-3 px-5 shadow-hard-xs flex items-center gap-2 w-fit"
        >
          <Flame className="w-4 h-4 text-[#09090B]" />
          <span>COOK A VIDEO NOW →</span>
        </Link>
      </div>

      {/* Grid: Quick Capture Form + Idea List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Capture Card */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-6 shadow-hard-md space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b-2 border-[#09090B]">
              <Lightbulb className="w-5 h-5 text-[#09090B]" />
              <h3 className="font-display text-base uppercase">QUICK CAPTURE IDEA</h3>
            </div>

            <form onSubmit={handleCreateIdea} className="space-y-3.5 text-xs font-mono">
              <div className="space-y-1">
                <label className="font-bold text-[#09090B] uppercase">IDEA / HOOK TITLE *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., The 3 rules of high retention video hooks..."
                  className="w-full bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#D2E823]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#09090B] uppercase">SOURCE PLATFORM</label>
                <select
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value)}
                  className="w-full bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#D2E823]"
                >
                  <option value="general">GENERAL / NOTE</option>
                  <option value="youtube">YOUTUBE</option>
                  <option value="instagram">INSTAGRAM</option>
                  <option value="tiktok">TIKTOK</option>
                  <option value="linkedin">LINKEDIN</option>
                  <option value="x">𝕏 (TWITTER)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#09090B] uppercase">SOURCE URL (OPTIONAL)</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#D2E823]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#09090B] uppercase">CONTEXT / RAW NOTES</label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Paste highlighted dialogue, key quote, or outline..."
                  className="w-full bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-[#D2E823]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#09090B] uppercase">TAGS (COMMA SEPARATED)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="viral, framework, podcast"
                  className="w-full bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#D2E823]"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="w-full btn-neo-acid py-3 font-display text-xs uppercase font-bold flex items-center justify-center gap-2 shadow-hard-xs disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{creating ? "SAVING IDEA..." : "SAVE TO IDEA BANK"}</span>
              </button>
            </form>
          </div>

          {/* Chrome Extension Promo Card */}
          <div className="bg-[#D2E823] border-3 border-[#09090B] rounded-2xl p-5 shadow-hard-md space-y-2.5">
            <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono px-2 py-0.5 rounded font-bold">
              BROWSER EXTENSION
            </span>
            <h4 className="font-display text-base uppercase leading-tight">
              CLIP HIGHLIGHTS ON THE WEB
            </h4>
            <p className="font-mono text-xs text-[#09090B]/80 leading-relaxed">
              Right click any selected text on YouTube, TikTok, or LinkedIn to instantly send it to this Idea Bank with auto-generated hooks.
            </p>
          </div>
        </div>

        {/* Right Column: Idea Stream & Platform Filters */}
        <div className="lg:col-span-8 space-y-6">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 bg-[#FFFFFF] p-2 rounded-2xl border-2 border-[#09090B] shadow-hard-xs">
            {PLATFORMS.map((plat) => (
              <button
                key={plat.id}
                onClick={() => setActivePlatformFilter(plat.id)}
                className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold border-2 border-[#09090B] transition-all ${
                  activePlatformFilter === plat.id
                    ? "bg-[#D2E823] text-[#09090B] shadow-hard-xs scale-[1.02]"
                    : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#eae6d8]"
                }`}
              >
                {plat.label}
              </button>
            ))}
          </div>

          {/* Ideas List */}
          {loading ? (
            <div className="neo-card p-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 mx-auto animate-spin text-[#09090B]" />
              <p className="font-mono text-xs font-bold">LOADING CREATOR IDEAS...</p>
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="neo-card p-12 text-center space-y-4 bg-[#FFFFFF]">
              <Lightbulb className="w-12 h-12 mx-auto text-[#09090B]/40" />
              <div className="space-y-1 max-w-sm mx-auto">
                <h3 className="font-display text-lg uppercase">NO IDEAS SAVED YET</h3>
                <p className="font-mono text-xs text-[#09090B]/70">
                  Add an idea using the quick capture form or save text directly using the COOK Chrome extension.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-5 shadow-hard-sm hover:shadow-hard-md transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                          {idea.platform}
                        </span>
                        <span className="text-[10px] font-mono text-[#09090B]/50 font-bold">
                          {new Date(idea.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-display text-base uppercase text-[#09090B]">
                        {idea.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleDeleteIdea(idea.id)}
                        className="p-1.5 rounded-lg border border-[#09090B]/20 hover:bg-red-50 text-red-600 transition-all"
                        title="Delete Idea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {idea.notes && (
                    <div className="bg-[#F8F4E8] border border-[#09090B]/20 p-3 rounded-xl font-mono text-xs text-[#09090B]/80 leading-relaxed">
                      &ldquo;{idea.notes}&rdquo;
                    </div>
                  )}

                  {/* Auto-Generated Angles */}
                  {idea.angles && idea.angles.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">
                        AI SUGGESTED HOOK ANGLES:
                      </span>
                      <div className="space-y-1">
                        {idea.angles.map((angle, aIdx) => (
                          <div
                            key={aIdx}
                            className="bg-[#FFFFFF] border border-[#09090B] p-2 rounded-lg flex items-center justify-between gap-2 text-[11px] font-mono"
                          >
                            <span className="text-[#09090B] truncate">{angle}</span>
                            <button
                              onClick={() => handleCopy(angle, `${idea.id}_${aIdx}`)}
                              className="p-1 hover:bg-black/10 rounded flex-shrink-0"
                            >
                              {copiedId === `${idea.id}_${aIdx}` ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-[#09090B]" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer tags and action */}
                  <div className="pt-2 border-t border-[#09090B]/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {idea.tags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="bg-[#F8F4E8] border border-[#09090B] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <Link
                      href="/upload"
                      className="flex items-center gap-1 text-xs font-mono font-bold bg-[#D2E823] hover:bg-[#b8cb1e] text-[#09090B] border border-[#09090B] px-3 py-1 rounded-lg shadow-hard-xs transition-all"
                    >
                      <span>COOK THIS IDEA</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
