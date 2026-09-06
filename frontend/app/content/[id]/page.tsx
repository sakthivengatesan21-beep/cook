"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Flame,
  ArrowLeft,
  Download,
  Copy,
  Check,
  Sparkles,
  Scissors,
  Share2,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  Sliders,
  CheckCircle2,
  Quote,
  ChevronDown,
  ChevronUp,
  Award,
  Type,
  Layers,
  Eye,
  Palette,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";
import Sticker from "@/components/Sticker";
import ScoreBadge from "@/components/ScoreBadge";
import {
  getClipItem,
  updateClip,
  regenerateClip,
  burnClipCaptions,
  getClipDownloadUrl,
  getClipSrtUrl,
  getClipAssUrl,
} from "@/lib/api";
import { Clip, CaptionPhrase } from "@/types";

export default function ClipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const clipId = resolvedParams.id;

  const [clip, setClip] = useState<Clip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [burningCaptions, setBurningCaptions] = useState(false);
  const [burnSuccessMessage, setBurnSuccessMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"captioned" | "raw">("captioned");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [showScoreReasons, setShowScoreReasons] = useState(false);

  // Caption Studio State
  const [captionStyle, setCaptionStyle] = useState<string>("ACID");
  const [captionPosition, setCaptionPosition] = useState<string>("BOTTOM");
  const [enableActiveHighlight, setEnableActiveHighlight] = useState<boolean>(true);
  const [captionPhrases, setCaptionPhrases] = useState<CaptionPhrase[]>([]);

  // Editable Form State
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(10);
  const [selectedHook, setSelectedHook] = useState<string>("");
  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [platformTab, setPlatformTab] = useState<"instagram" | "shorts" | "tiktok" | "linkedin">("instagram");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState<string>("");

  useEffect(() => {
    async function loadClip() {
      try {
        setLoading(true);
        const data = await getClipItem(clipId);
        setClip(data);
        setStartTime(data.start_time);
        setEndTime(data.end_time);
        setCaptionStyle(data.caption_style || "ACID");
        setCaptionPosition(data.caption_position || "BOTTOM");
        setCaptionPhrases(data.caption_phrases || []);

        const meta = data.metadata;
        if (meta) {
          setSelectedHook(meta.selected_hook || meta.hooks[0] || data.hook);
          setSelectedTitle(meta.selected_title || meta.titles[0] || data.topic);
          setCaption(meta.caption || "");
          setHashtags(meta.hashtags || []);
        }
      } catch (err) {
        console.error("Failed to load clip:", err);
      } finally {
        setLoading(false);
      }
    }
    loadClip();
  }, [clipId]);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveMetadata = async () => {
    try {
      setSaving(true);
      await updateClip(clipId, {
        selected_hook: selectedHook,
        selected_title: selectedTitle,
        caption: caption,
        hashtags: hashtags,
      });
      setCopiedField("saved");
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      const res = await regenerateClip(clipId, startTime, endTime);
      if (res.success && res.clip) {
        setClip(res.clip);
        if (res.clip.caption_phrases) {
          setCaptionPhrases(res.clip.caption_phrases);
        }
      }
    } catch (err) {
      console.error("Regenerate error:", err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleBurnCaptions = async () => {
    try {
      setBurningCaptions(true);
      setBurnSuccessMessage(null);
      const res = await burnClipCaptions(clipId, {
        style: captionStyle,
        position: captionPosition,
        enable_active_highlight: enableActiveHighlight,
        phrases: captionPhrases,
      });
      if (res.success && res.clip) {
        setClip(res.clip);
        setPreviewMode("captioned");
        setBurnSuccessMessage(`Captions baked in ${captionStyle} style!`);
        setTimeout(() => setBurnSuccessMessage(null), 3500);
      }
    } catch (err: any) {
      console.error("Burn captions error:", err);
      alert(err.message || "Failed to burn captions");
    } finally {
      setBurningCaptions(false);
    }
  };

  const handlePhraseTextChange = (phraseIdx: number, newText: string) => {
    setCaptionPhrases((prev) =>
      prev.map((p, idx) => (idx === phraseIdx ? { ...p, text: newText } : p))
    );
  };

  const handleAddHashtag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newTagInput.trim()) {
      e.preventDefault();
      let tag = newTagInput.trim();
      if (!tag.startsWith("#")) tag = "#" + tag;
      if (!hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setNewTagInput("");
    }
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  if (loading || !clip) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-20 text-center space-y-4">
        <Flame className="w-12 h-12 mx-auto text-[#09090B] animate-bounce" />
        <h2 className="font-display text-2xl text-[#09090B]">LOADING CLIP WORKSPACE...</h2>
      </div>
    );
  }

  const meta = clip.metadata;
  const scoreBreakdown = meta?.score_breakdown;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 w-full space-y-8">
      {/* Top Back & Action Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#09090B]">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="btn-neo-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-hard-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO DASHBOARD</span>
          </Link>
          <span className="font-display text-lg text-[#09090B]">
            CLIP #{clip.clip_number < 10 ? `0${clip.clip_number}` : clip.clip_number}
          </span>
          <span className="text-xs font-mono font-bold bg-[#D2E823] px-2 py-0.5 rounded border border-[#09090B]">
            {clip.start_time}s — {clip.end_time}s
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveMetadata}
            disabled={saving}
            className="btn-neo-primary text-xs py-2.5 px-4 shadow-hard-xs flex items-center gap-2"
          >
            {copiedField === "saved" ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#D2E823]" />
                <span>SAVED!</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#D2E823]" />
                <span>{saving ? "SAVING..." : "SAVE METADATA"}</span>
              </>
            )}
          </button>

          <a
            href={getClipDownloadUrl(clip.id)}
            download
            className="btn-neo-acid text-xs py-2.5 px-4 shadow-hard-xs flex items-center gap-2 font-display"
          >
            <Download className="w-3.5 h-3.5" />
            <span>DOWNLOAD VIDEO</span>
          </a>
        </div>
      </div>

      {/* Main 2-Column Editing Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (5 cols): Video Player & Full Caption Studio */}
        <div className="lg:col-span-5 space-y-6">
          {/* Vertical Video Player with Captions Toggle */}
          <div className="neo-card p-4 bg-[#09090B] border-4 border-[#09090B] shadow-hard-lg space-y-3">
            {/* Version Switcher Bar */}
            <div className="flex items-center justify-between bg-black/50 p-1.5 rounded-xl border border-white/20">
              <span className="text-[10px] font-mono text-[#D2E823] font-bold uppercase pl-1">
                PREVIEW:
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewMode("captioned")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    previewMode === "captioned"
                      ? "bg-[#D2E823] text-[#09090B] shadow-hard-xs"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  WITH CAPTIONS
                </button>
                <button
                  onClick={() => setPreviewMode("raw")}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    previewMode === "raw"
                      ? "bg-white text-[#09090B] shadow-hard-xs"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  RAW 9:16
                </button>
              </div>
            </div>

            {/* Video Player */}
            <div className="aspect-[9/16] w-full max-h-[560px] bg-black rounded-2xl overflow-hidden relative border-2 border-[#D2E823]/40">
              <video
                key={previewMode === "captioned" ? clip.captioned_video_url : clip.vertical_video_url}
                src={previewMode === "captioned" && clip.captioned_video_url ? clip.captioned_video_url : clip.vertical_video_url}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-[#F8F4E8]">
              <span className="text-[#D2E823] font-bold">
                ● {previewMode === "captioned" ? `BURNED: ${captionStyle} (${captionPosition})` : "RAW 9:16 (UNCAPTIONED)"}
              </span>
              <span>{clip.duration}s</span>
            </div>
          </div>

          {/* AI CAPTION STUDIO */}
          <div className="neo-card p-5 space-y-5 bg-[#FFFFFF] border-4 border-[#09090B] shadow-hard-md">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#09090B]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#D2E823] border border-[#09090B] flex items-center justify-center">
                  <Type className="w-4 h-4 text-[#09090B]" />
                </div>
                <div>
                  <h3 className="font-display text-sm text-[#09090B] uppercase leading-none">
                    CAPTION STUDIO
                  </h3>
                  <span className="text-[10px] font-mono text-[#09090B]/60 font-semibold">
                    REAL SPOKEN SPEECH • ASS 9:16
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold bg-[#D2E823] text-[#09090B] px-2 py-0.5 rounded border border-[#09090B]">
                {captionPhrases.length} PHRASES
              </span>
            </div>

            {/* Style Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono font-bold text-[#09090B] uppercase flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-[#09090B]" />
                <span>CAPTION THEME</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "ACID", name: "ACID (COOK)", desc: "Yellow karaoke highlight" },
                  { id: "BOLD", name: "BOLD", desc: "Heavy white impact stroke" },
                  { id: "MINIMAL", name: "MINIMAL", desc: "Clean modern typography" },
                  { id: "CLASSIC", name: "CLASSIC", desc: "Yellow fill black border" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCaptionStyle(s.id)}
                    className={`p-2 rounded-xl border-2 text-left transition-all flex flex-col gap-0.5 ${
                      captionStyle === s.id
                        ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs"
                        : "bg-[#F8F4E8] border-[#09090B]/30 hover:border-[#09090B]"
                    }`}
                  >
                    <span className="font-display text-[11px] text-[#09090B] uppercase font-bold">{s.name}</span>
                    <span className="text-[9px] font-mono text-[#09090B]/70">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Position Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-mono font-bold text-[#09090B] uppercase flex items-center gap-1.5">
                <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-[#09090B]" />
                <span>POSITION (9:16 SAFE AREA)</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "BOTTOM", label: "BOTTOM", icon: AlignVerticalJustifyEnd },
                  { id: "CENTER", label: "CENTER", icon: AlignVerticalJustifyCenter },
                  { id: "TOP", label: "TOP", icon: AlignVerticalJustifyStart },
                ].map((pos) => {
                  const Icon = pos.icon;
                  return (
                    <button
                      key={pos.id}
                      onClick={() => setCaptionPosition(pos.id)}
                      className={`py-2 px-2 rounded-xl border-2 text-center text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                        captionPosition === pos.id
                          ? "bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-xs"
                          : "bg-[#F8F4E8] text-[#09090B] border-[#09090B]/30 hover:border-[#09090B]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{pos.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active-Word Karaoke Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-[#F8F4E8] rounded-xl border-2 border-[#09090B]">
              <div className="space-y-0.5">
                <span className="text-xs font-display text-[#09090B] uppercase">KARAOKE ACTIVE-WORD SYNC</span>
                <p className="text-[10px] font-mono text-[#09090B]/70">Highlights currently spoken word in #D2E823</p>
              </div>
              <button
                onClick={() => setEnableActiveHighlight(!enableActiveHighlight)}
                className={`w-12 h-6 rounded-full border-2 border-[#09090B] transition-colors relative ${
                  enableActiveHighlight ? "bg-[#D2E823]" : "bg-zinc-300"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[#09090B] transition-transform absolute top-0.5 ${
                    enableActiveHighlight ? "left-6" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Phrase Editor Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono font-bold text-[#09090B] uppercase">
                  EDIT SPOKEN PHRASES ({captionPhrases.length})
                </label>
                <span className="text-[10px] font-mono text-[#09090B]/60 font-semibold">Click text to edit</span>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 bg-[#F8F4E8] rounded-xl border-2 border-[#09090B]">
                {captionPhrases.map((phrase, pIdx) => (
                  <div
                    key={pIdx}
                    className="p-2 bg-white rounded-lg border border-[#09090B]/30 hover:border-[#09090B] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="bg-[#09090B] text-[#D2E823] px-1.5 py-0.2 rounded font-bold">
                        #{phrase.index}
                      </span>
                      <span className="text-[#09090B]/70 font-semibold">
                        {phrase.start.toFixed(2)}s → {phrase.end.toFixed(2)}s
                      </span>
                    </div>
                    <input
                      type="text"
                      value={phrase.text}
                      onChange={(e) => handlePhraseTextChange(pIdx, e.target.value)}
                      className="w-full text-xs font-mono font-bold p-1.5 bg-[#F8F4E8] rounded border border-[#09090B]/30 focus:border-[#09090B] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Re-Burn Captions Action Button */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleBurnCaptions}
                disabled={burningCaptions}
                className="btn-neo-primary w-full py-3 text-xs flex items-center justify-center gap-2 font-display uppercase tracking-wider"
              >
                <RefreshCw className={`w-4 h-4 ${burningCaptions ? "animate-spin text-[#D2E823]" : "text-[#D2E823]"}`} />
                <span>{burningCaptions ? "BURNING ASS CAPTIONS WITH FFMPEG..." : "RE-BURN CAPTIONS INTO 9:16 →"}</span>
              </button>

              {burnSuccessMessage && (
                <div className="p-2 bg-[#D2E823] text-[#09090B] rounded-lg border-2 border-[#09090B] text-center text-xs font-mono font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{burnSuccessMessage}</span>
                </div>
              )}
            </div>

            {/* Subtitle & Video Direct Downloads */}
            <div className="pt-3 border-t-2 border-[#09090B]/10 grid grid-cols-2 gap-2 text-center text-[10px] font-mono font-bold">
              <a
                href={getClipDownloadUrl(clip.id, "captioned")}
                download
                className="btn-neo-acid py-2 px-1 flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>CAPTIONED MP4</span>
              </a>
              <a
                href={getClipDownloadUrl(clip.id, "raw")}
                download
                className="btn-neo-secondary py-2 px-1 flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>RAW 9:16 MP4</span>
              </a>
              <a
                href={getClipSrtUrl(clip.id)}
                download
                className="btn-neo-secondary py-2 px-1 flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3" />
                <span>DOWNLOAD .SRT</span>
              </a>
              <a
                href={getClipAssUrl(clip.id)}
                download
                className="btn-neo-secondary py-2 px-1 flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3" />
                <span>DOWNLOAD .ASS</span>
              </a>
            </div>
          </div>

          {/* Lightweight Trimmer & Regenerate Tool */}
          <div className="neo-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#09090B]" />
              <h3 className="font-display text-sm text-[#09090B] uppercase">
                TRIMMER & RE-CUT
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-[#09090B]/70 uppercase">
                  START (SEC)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={startTime}
                  onChange={(e) => setStartTime(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-lg border-2 border-[#09090B] font-mono text-sm font-bold bg-[#F8F4E8]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-[#09090B]/70 uppercase">
                  END (SEC)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={endTime}
                  onChange={(e) => setEndTime(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-lg border-2 border-[#09090B] font-mono text-sm font-bold bg-[#F8F4E8]"
                />
              </div>
            </div>

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="btn-neo-secondary w-full text-xs py-2.5 flex items-center justify-center gap-2 font-display uppercase"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
              <span>{regenerating ? "RE-RENDERING WITH FFMPEG..." : "RE-CUT CLIP INTERVAL →"}</span>
            </button>
          </div>
        </div>

        {/* Right Column (7 cols): Content Controls & Metadata Workspace */}
        <div className="lg:col-span-7 space-y-6">
          {/* AI Content Score Breakdown Card */}
          <div className="neo-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#09090B]/60 font-bold uppercase">GROUNDED MOMENT</span>
                <h3 className="font-display text-xl text-[#09090B] uppercase">{clip.topic}</h3>
                <p className="text-xs font-mono text-[#09090B]/70">{clip.reason}</p>
              </div>
              <ScoreBadge
                score={clip.score}
                hookScore={clip.hook_score}
                informationScore={clip.information_score}
                emotionScore={clip.emotion_score}
                curiosityScore={clip.curiosity_score}
                shareabilityScore={clip.shareability_score}
                standaloneValue={clip.standalone_value}
                showBreakdown={true}
                size="md"
              />
            </div>

            {/* Explainable Score Reasons Toggle */}
            {scoreBreakdown && (
              <div className="pt-3 border-t-2 border-[#09090B]/10 space-y-2">
                <button
                  onClick={() => setShowScoreReasons(!showScoreReasons)}
                  className="text-xs font-mono font-bold flex items-center gap-1.5 text-[#09090B] hover:underline"
                >
                  <Award className="w-3.5 h-3.5 text-[#09090B]" />
                  <span>{showScoreReasons ? "HIDE SCORE BREAKDOWN REASONS" : "WHY COOK SCORED THIS MOMENT →"}</span>
                  {showScoreReasons ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showScoreReasons && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono pt-2">
                    <div className="p-2.5 bg-[#F8F4E8] rounded-lg border border-[#09090B]/20 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>HOOK ({scoreBreakdown.hook.score}/100)</span>
                      </div>
                      <p className="text-[11px] text-[#09090B]/80 font-sans">{scoreBreakdown.hook.reason}</p>
                    </div>
                    <div className="p-2.5 bg-[#F8F4E8] rounded-lg border border-[#09090B]/20 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>CLARITY ({scoreBreakdown.clarity.score}/100)</span>
                      </div>
                      <p className="text-[11px] text-[#09090B]/80 font-sans">{scoreBreakdown.clarity.reason}</p>
                    </div>
                    <div className="p-2.5 bg-[#F8F4E8] rounded-lg border border-[#09090B]/20 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>STORY ARC ({scoreBreakdown.story.score}/100)</span>
                      </div>
                      <p className="text-[11px] text-[#09090B]/80 font-sans">{scoreBreakdown.story.reason}</p>
                    </div>
                    <div className="p-2.5 bg-[#F8F4E8] rounded-lg border border-[#09090B]/20 space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>VALUE DENSITY ({scoreBreakdown.value.score}/100)</span>
                      </div>
                      <p className="text-[11px] text-[#09090B]/80 font-sans">{scoreBreakdown.value.reason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Genuine Spoken Transcript Proof Section */}
          <div className="neo-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Quote className="w-4 h-4 text-[#09090B]" />
                <h4 className="font-display text-xs text-[#09090B] uppercase">
                  SOURCE TRANSCRIPT ({clip.start_time}s — {clip.end_time}s)
                </h4>
              </div>
              <button
                onClick={() => handleCopy(clip.transcript, "transcript")}
                className="text-[10px] font-mono font-bold flex items-center gap-1 hover:underline"
              >
                {copiedField === "transcript" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === "transcript" ? "COPIED" : "COPY"}</span>
              </button>
            </div>
            <div className="p-3 bg-[#F8F4E8] rounded-xl border-2 border-[#09090B] text-xs font-mono leading-relaxed text-[#09090B]">
              "{clip.transcript}"
            </div>
            <div className="text-[10px] font-mono text-[#09090B]/60 font-semibold">
              ✓ Verified spoken audio segment extracted via faster-whisper.
            </div>
          </div>

          {/* Grounded Smart Hooks Selector (5 Strategies) */}
          {meta && meta.hooks && (
            <div className="neo-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 fill-[#09090B]" />
                  <h4 className="font-display text-xs text-[#09090B] uppercase">
                    GROUNDED HOOKS ({meta.hooks.length} STRATEGIES)
                  </h4>
                </div>
                <button
                  onClick={() => handleCopy(selectedHook, "hook")}
                  className="text-[10px] font-mono font-bold flex items-center gap-1 hover:underline"
                >
                  {copiedField === "hook" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "hook" ? "COPIED" : "COPY HOOK"}</span>
                </button>
              </div>

              <div className="space-y-2">
                {meta.hooks.map((h, hIdx) => {
                  const isSelected = selectedHook === h;
                  const hookObj = meta.structured_hooks?.[hIdx];
                  return (
                    <div
                      key={hIdx}
                      onClick={() => setSelectedHook(h)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col gap-1.5 select-none ${
                        isSelected
                          ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs"
                          : "bg-white border-[#09090B]/40 hover:border-[#09090B] hover:bg-[#F8F4E8]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-[10px] bg-[#09090B] text-[#D2E823] px-1.5 py-0.5 rounded flex-shrink-0">
                            0{hIdx + 1}
                          </span>
                          {hookObj && (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-[#09090B]/10 px-2 py-0.5 rounded">
                              {hookObj.type}
                            </span>
                          )}
                        </div>
                        {hookObj && (
                          <span className="font-mono text-[10px] font-bold">
                            ATTN: {hookObj.attention_score}/100
                          </span>
                        )}
                      </div>
                      <p className="font-body text-xs font-bold leading-snug text-[#09090B]">{h}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Platform Captions Editor */}
          <div className="neo-card p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#09090B]" />
                <h4 className="font-display text-xs text-[#09090B] uppercase">PLATFORM CAPTION</h4>
              </div>

              {/* Platform Switcher Tabs */}
              <div className="flex items-center gap-1 bg-[#09090B] p-1 rounded-lg">
                {(["instagram", "shorts", "tiktok", "linkedin"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPlatformTab(p);
                      if (meta?.platform_captions?.[p]) {
                        setCaption(meta.platform_captions[p]);
                      }
                    }}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase transition-all ${
                      platformTab === p ? "bg-[#D2E823] text-[#09090B]" : "text-white/70 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full p-3 rounded-xl border-2 border-[#09090B] font-body text-xs leading-relaxed bg-[#F8F4E8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#D2E823]"
              placeholder="Enter your platform caption..."
            />

            <div className="flex justify-end">
              <button
                onClick={() => handleCopy(caption, "caption")}
                className="btn-neo-secondary text-xs py-1.5 px-3 flex items-center gap-1 font-mono font-bold"
              >
                {copiedField === "caption" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === "caption" ? "COPIED" : "COPY CAPTION"}</span>
              </button>
            </div>
          </div>

          {/* Titles & Hashtags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title Options */}
            {meta && meta.titles && (
              <div className="neo-card p-4 space-y-2.5">
                <h4 className="font-display text-xs text-[#09090B] uppercase">TITLE OPTIONS</h4>
                <div className="space-y-1.5">
                  {meta.titles.map((t, tIdx) => (
                    <div
                      key={tIdx}
                      onClick={() => setSelectedTitle(t)}
                      className={`p-2 rounded-lg border-2 cursor-pointer text-xs font-bold transition-all ${
                        selectedTitle === t
                          ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs"
                          : "bg-white border-[#09090B]/30 hover:border-[#09090B]"
                      }`}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtag Editor */}
            <div className="neo-card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-xs text-[#09090B] uppercase">HASHTAGS</h4>
                <button
                  onClick={() => handleCopy(hashtags.join(" "), "tags")}
                  className="text-[10px] font-mono font-bold flex items-center gap-1 hover:underline"
                >
                  {copiedField === "tags" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedField === "tags" ? "COPIED" : "COPY ALL"}</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {hashtags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono font-bold bg-[#D2E823] text-[#09090B] px-2 py-0.5 rounded border border-[#09090B] flex items-center gap-1"
                  >
                    <span>{tag}</span>
                    <button
                      onClick={() => handleRemoveHashtag(tag)}
                      className="hover:text-red-700 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddHashtag}
                placeholder="+ Type tag & press Enter..."
                className="w-full p-2 text-xs font-mono font-bold rounded-lg border-2 border-[#09090B] bg-[#F8F4E8]"
              />
            </div>
          </div>

          {/* Thumbnail Concept Card */}
          {meta && meta.thumbnail_idea && (
            <div className="neo-card p-5 space-y-3 bg-[#09090B] text-[#F8F4E8] border-2 border-[#09090B] shadow-hard-acid">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#D2E823]" />
                <h4 className="font-display text-xs text-[#D2E823] uppercase">
                  THUMBNAIL CONCEPT (GROUNDED)
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-2.5 bg-[#18181b] rounded-lg border border-white/10 space-y-0.5">
                  <span className="text-[9px] text-[#D2E823] uppercase font-bold">HEADLINE TEXT</span>
                  <p className="font-display text-sm text-[#F8F4E8] uppercase">{meta.thumbnail_idea.headline}</p>
                </div>
                <div className="p-2.5 bg-[#18181b] rounded-lg border border-white/10 space-y-0.5">
                  <span className="text-[9px] text-[#D2E823] uppercase font-bold">EXPRESSION</span>
                  <p className="text-white/90">{meta.thumbnail_idea.expression}</p>
                </div>
                <div className="p-2.5 bg-[#18181b] rounded-lg border border-white/10 space-y-0.5 sm:col-span-2">
                  <span className="text-[9px] text-[#D2E823] uppercase font-bold">VISUAL COMPOSITION</span>
                  <p className="text-white/90">{meta.thumbnail_idea.visual_concept}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
