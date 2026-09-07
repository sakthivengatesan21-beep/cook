"use client";

import React, { useState } from "react";
import { Clip, ContentGenomeMoment, HookItem } from "@/types";
import {
  API_BASE,
  burnCaptions,
  trimClipSilence,
  translateClip,
  remixClipAspect,
  generateClipThumbnails,
  updateClip,
  getClipDownloadUrl,
  getClipSrtUrl,
  getClipModeration,
} from "@/lib/api";
import {
  X,
  Sparkles,
  Copy,
  Check,
  Download,
  Share2,
  Globe,
  Scissors,
  Eye,
  Sliders,
  Flame,
  HelpCircle,
  TrendingUp,
  FileText,
  Search,
  Volume2,
  Play,
  RotateCcw,
  Zap,
  CheckCircle2,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Type,
  Palette,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  RefreshCw,
} from "lucide-react";

interface ContentPackModalProps {
  clip: Clip | null;
  genomeMoment?: ContentGenomeMoment | null;
  isOpen: boolean;
  onClose: () => void;
  onClipUpdated?: (updatedClip: Clip) => void;
}

const LANGUAGES = [
  { code: "en", name: "English 🇺🇸" },
  { code: "ta", name: "Tamil (தமிழ்) 🇮🇳" },
  { code: "hi", name: "Hindi (हिन्दी) 🇮🇳" },
  { code: "te", name: "Telugu (తెలుగు) 🇮🇳" },
  { code: "ml", name: "Malayalam (മലയാളം) 🇮🇳" },
  { code: "kn", name: "Kannada (ಕನ್ನಡ) 🇮🇳" },
  { code: "bn", name: "Bengali (বাংলা) 🇮🇳" },
  { code: "mr", name: "Marathi (मराठी) 🇮🇳" },
  { code: "gu", name: "Gujarati (ગુજરાતી) 🇮🇳" },
  { code: "pa", name: "Punjabi (ਪੰਜਾਬੀ) 🇮🇳" },
  { code: "es", name: "Spanish 🇪🇸" },
  { code: "fr", name: "French 🇫🇷" },
  { code: "de", name: "German 🇩🇪" },
  { code: "ja", name: "Japanese 🇯🇵" },
  { code: "ar", name: "Arabic 🇦🇪" },
];

export default function ContentPackModal({
  clip,
  genomeMoment,
  isOpen,
  onClose,
  onClipUpdated,
}: ContentPackModalProps) {
  const [activeTab, setActiveTab] = useState<
    "hooks" | "posts" | "captions" | "seo" | "translate" | "audio" | "thumbnails" | "explain" | "moderation"
  >("hooks");
  const [activePlatform, setActivePlatform] = useState<"instagram" | "tiktok" | "shorts" | "linkedin" | "x">(
    "instagram"
  );
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [localClip, setLocalClip] = useState<Clip | null>(clip);
  const [moderationReport, setModerationReport] = useState<any>(null);
  const [loadingModeration, setLoadingModeration] = useState(false);

  // Caption Studio State
  const [captionStyle, setCaptionStyle] = useState<string>(clip?.caption_style || "ACID");
  const [captionPosition, setCaptionPosition] = useState<string>(clip?.caption_position || "BOTTOM");
  const [enableActiveHighlight, setEnableActiveHighlight] = useState<boolean>(true);
  const [captionPhrases, setCaptionPhrases] = useState<any[]>(clip?.caption_phrases || []);
  const [burningCaptions, setBurningCaptions] = useState(false);
  const [burnSuccessMessage, setBurnSuccessMessage] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalClip(clip);
    if (clip) {
      setCaptionStyle(clip.caption_style || "ACID");
      setCaptionPosition(clip.caption_position || "BOTTOM");
      setCaptionPhrases(clip.caption_phrases || []);
    }
  }, [clip]);

  if (!isOpen || !localClip) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleBurnCaptions = async () => {
    if (!localClip) return;
    setBurningCaptions(true);
    setBurnSuccessMessage(null);
    try {
      const res = await burnCaptions(localClip.id, {
        style: captionStyle,
        position: captionPosition,
        enable_active_highlight: enableActiveHighlight,
        phrases: captionPhrases,
      });
      if (res && res.clip) {
        setLocalClip(res.clip);
        if (onClipUpdated) onClipUpdated(res.clip);
        setBurnSuccessMessage(`Captions burned in ${captionStyle} style!`);
        setTimeout(() => setBurnSuccessMessage(null), 3500);
      }
    } catch (e: any) {
      alert(`Caption burning failed: ${e.message}`);
    } finally {
      setBurningCaptions(false);
    }
  };

  const handlePhraseTextChange = (phraseIdx: number, newText: string) => {
    setCaptionPhrases((prev) =>
      prev.map((p, idx) => (idx === phraseIdx ? { ...p, text: newText } : p))
    );
  };

  const handleSelectHook = async (hookText: string) => {
    if (!localClip) return;
    try {
      const updated = await updateClip(localClip.id, { selected_hook: hookText });
      setLocalClip(updated);
      if (onClipUpdated) onClipUpdated(updated);
    } catch (e) {
      console.error("Failed to select hook", e);
    }
  };

  const handleTrimSilence = async () => {
    if (!localClip) return;
    setLoadingAction("silence");
    try {
      const res = await trimClipSilence(localClip.id, 1.2, true);
      if (res && res.clip) {
        setLocalClip(res.clip);
        if (onClipUpdated) onClipUpdated(res.clip);
      }
    } catch (e: any) {
      alert(`Silence trim failed: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTranslate = async (langCode: string) => {
    if (!localClip) return;
    setSelectedLanguage(langCode);
    setLoadingAction(`trans_${langCode}`);
    try {
      const res = await translateClip(localClip.id, langCode);
      if (res && res.clip) {
        setLocalClip(res.clip);
        if (onClipUpdated) onClipUpdated(res.clip);
      }
    } catch (e: any) {
      console.error("Translation failed", e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAspectRemix = async (aspect: "9:16" | "1:1" | "16:9") => {
    if (!localClip) return;
    setAspectRatio(aspect);
    setLoadingAction(`aspect_${aspect}`);
    try {
      const res = await remixClipAspect(localClip.id, aspect);
      if (res && res.clip) {
        setLocalClip(res.clip);
        if (onClipUpdated) onClipUpdated(res.clip);
      }
    } catch (e: any) {
      console.error("Aspect remix failed", e);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleGenerateThumbnails = async () => {
    if (!localClip) return;
    setLoadingAction("thumbs");
    try {
      const res = await generateClipThumbnails(localClip.id);
      if (res && res.clip) {
        setLocalClip(res.clip);
        if (onClipUpdated) onClipUpdated(res.clip);
      }
    } catch (e: any) {
      alert(`Thumbnail generation failed: ${e.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Video source resolver
  const getVideoSource = () => {
    if (aspectRatio === "1:1" && localClip.square_video_url) {
      return localClip.square_video_url.startsWith("http")
        ? localClip.square_video_url
        : `${API_BASE}${localClip.square_video_url}`;
    }
    if (aspectRatio === "16:9" && localClip.landscape_video_url) {
      return localClip.landscape_video_url.startsWith("http")
        ? localClip.landscape_video_url
        : `${API_BASE}${localClip.landscape_video_url}`;
    }
    const raw = localClip.captioned_video_url || localClip.vertical_video_url || localClip.video_url;
    return raw.startsWith("http") ? raw : `${API_BASE}${raw}`;
  };

  const hooksList: HookItem[] =
    localClip.metadata?.structured_hooks ||
    genomeMoment?.hooks || [
      {
        type: "CURIOSITY",
        text: localClip.hook || localClip.transcript,
        attention_score: 95,
        clarity_score: 90,
        style_match: 92,
        reason: "Opens strong loop based on spoken audio",
      },
    ];

  const platformCaptions =
    localClip.metadata?.platform_captions || genomeMoment?.platform_captions || {};
  const seoPackage = localClip.metadata?.seo_package || genomeMoment?.seo_package;
  const whyThis = localClip.metadata?.why_this_clip || genomeMoment?.why_this_clip;
  const translations = localClip.metadata?.translations || genomeMoment?.translations;
  const thumbnailCandidates =
    localClip.metadata?.thumbnail_candidates ||
    genomeMoment?.thumbnail_candidates || [localClip.metadata?.thumbnail_idea].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FFFFFF] border-4 border-[#09090B] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-[12px_12px_0px_#D2E823] overflow-hidden text-[#09090B]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-3 border-[#09090B] bg-[#F8F4E8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center font-display text-sm font-bold shadow-hard-xs">
              #{localClip.clip_number}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg tracking-tight uppercase">COMPLETE CONTENT PACK</h2>
                <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                  {localClip.version || "v1"}
                </span>
              </div>
              <p className="font-mono text-xs text-[#09090B]/70 truncate max-w-md">
                {localClip.topic || "AI Curated Moment"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#09090B] text-[#F8F4E8] hover:bg-[#D2E823] hover:text-[#09090B] border-2 border-[#09090B] flex items-center justify-center transition-all shadow-hard-xs"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-[#09090B]">
          {/* Left Column: Player & Aspect Ratio Controls */}
          <div className="lg:col-span-5 p-6 bg-[#F8F4E8] flex flex-col items-center justify-between gap-4">
            <div className="w-full space-y-3 flex flex-col items-center">
              {/* Aspect Ratio Switcher */}
              <div className="flex items-center gap-1.5 bg-[#FFFFFF] p-1 rounded-xl border-2 border-[#09090B] shadow-hard-xs">
                {(["9:16", "1:1", "16:9"] as const).map((asp) => (
                  <button
                    key={asp}
                    onClick={() => handleAspectRemix(asp)}
                    className={`px-3 py-1 text-xs font-mono font-bold rounded-lg border-2 border-[#09090B] transition-all ${
                      aspectRatio === asp
                        ? "bg-[#D2E823] text-[#09090B] shadow-hard-xs"
                        : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#eae6d8]"
                    }`}
                  >
                    {asp === "9:16" ? "📱 REEL (9:16)" : asp === "1:1" ? "⬛ SQUARE (1:1)" : "🖥 LANDSCAPE (16:9)"}
                  </button>
                ))}
              </div>

              {/* Video Player */}
              <div
                className={`relative bg-black rounded-2xl border-3 border-[#09090B] overflow-hidden shadow-hard-md flex items-center justify-center transition-all ${
                  aspectRatio === "9:16"
                    ? "w-[240px] h-[426px]"
                    : aspectRatio === "1:1"
                    ? "w-[300px] h-[300px]"
                    : "w-[380px] h-[214px]"
                }`}
              >
                <video
                  key={getVideoSource()}
                  src={getVideoSource()}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Quick Audio / Polish Bar */}
              <div className="flex flex-wrap items-center justify-center gap-2 w-full pt-1">
                <button
                  onClick={handleTrimSilence}
                  disabled={loadingAction === "silence"}
                  className="bg-[#FFFFFF] hover:bg-[#D2E823] border-2 border-[#09090B] px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 shadow-hard-xs transition-all"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>{loadingAction === "silence" ? "TRIMMING..." : "CUT SILENCES & FILLERS"}</span>
                </button>

                <button
                  onClick={handleGenerateThumbnails}
                  disabled={loadingAction === "thumbs"}
                  className="bg-[#FFFFFF] hover:bg-[#D2E823] border-2 border-[#09090B] px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 shadow-hard-xs transition-all"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>EXTRACT THUMBNAILS</span>
                </button>
              </div>
            </div>

            {/* Quick Export Downloads */}
            <div className="w-full flex items-center justify-between gap-2 pt-4 border-t-2 border-[#09090B]/20">
              <a
                href={getVideoSource()}
                download={`cook_${localClip.id}.mp4`}
                className="flex-1 bg-[#09090B] hover:bg-[#18181b] text-[#D2E823] border-2 border-[#09090B] py-2.5 rounded-xl font-display text-xs uppercase font-bold flex items-center justify-center gap-2 shadow-hard-xs transition-all"
              >
                <Download className="w-4 h-4" />
                <span>DOWNLOAD CLIP</span>
              </a>
              <a
                href={getClipSrtUrl(localClip.id)}
                download={`subtitles_${localClip.id}.srt`}
                className="bg-[#FFFFFF] hover:bg-[#F8F4E8] text-[#09090B] border-2 border-[#09090B] px-3 py-2.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1 shadow-hard-xs transition-all"
              >
                SRT
              </a>
            </div>
          </div>

          {/* Right Column: Tabbed Content Engines */}
          <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-4">
            {/* Engine Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-[#09090B] pb-3">
              {[
                { id: "hooks", label: "10 HOOKS", icon: Flame },
                { id: "posts", label: "5 PLATFORMS", icon: Share2 },
                { id: "captions", label: "CAPTION STUDIO", icon: Type },
                { id: "seo", label: "SEO PACK", icon: Search },
                { id: "translate", label: "MULTILINGUAL", icon: Globe },
                { id: "explain", label: "WHY THIS CLIP?", icon: HelpCircle },
                { id: "thumbnails", label: "THUMBNAILS", icon: Eye },
                { id: "moderation", label: "SAFETY CHECK", icon: ShieldCheck },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={async () => {
                      setActiveTab(tab.id as any);
                      if (tab.id === "moderation" && !moderationReport && localClip) {
                        setLoadingModeration(true);
                        try {
                          const rep = await getClipModeration(localClip.id);
                          setModerationReport(rep);
                        } catch (e) {
                          console.error("Failed to load moderation report", e);
                        } finally {
                          setLoadingModeration(false);
                        }
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border-2 border-[#09090B] transition-all ${
                      isActive
                        ? "bg-[#D2E823] text-[#09090B] shadow-hard-xs"
                        : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#FFFFFF]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: 10 HOOK STRATEGIES */}
            {activeTab === "hooks" && (
              <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#09090B]/70 uppercase">
                    10 AI HOOK ANGLES (TESTED FOR HIGH RETENTION)
                  </span>
                  <span className="text-[10px] font-mono bg-[#09090B] text-[#D2E823] px-2 py-0.5 rounded font-bold">
                    SELECT HOOK TO SAVE
                  </span>
                </div>

                <div className="space-y-2.5">
                  {hooksList.map((hook, idx) => {
                    const isSelected = (localClip.selected_hook || localClip.hook) === hook.text;
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] hover:bg-[#FFFFFF] transition-all flex flex-col justify-between gap-2 ${
                          isSelected ? "ring-2 ring-[#09090B] bg-[#FFFFFF] shadow-hard-xs" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                              {hook.type}
                            </span>
                            <span className="text-[10px] font-mono text-[#09090B]/60 font-bold">
                              SCORE: {hook.attention_score}/100
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopy(hook.text, `hook_${idx}`)}
                              className="p-1 rounded hover:bg-black/10 text-[#09090B]"
                            >
                              {copiedKey === `hook_${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleSelectHook(hook.text)}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border border-[#09090B] ${
                                isSelected ? "bg-[#D2E823] text-[#09090B]" : "bg-[#FFFFFF] text-[#09090B]"
                              }`}
                            >
                              {isSelected ? "ACTIVE" : "SET ACTIVE"}
                            </button>
                          </div>
                        </div>

                        <p className="font-display text-xs uppercase leading-snug text-[#09090B]">
                          &ldquo;{hook.text}&rdquo;
                        </p>
                        <span className="text-[10px] font-mono text-[#09090B]/60">{hook.reason}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: 5 PLATFORMS */}
            {activeTab === "posts" && (
              <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1">
                <div className="flex flex-wrap gap-1.5">
                  {(["instagram", "tiktok", "shorts", "linkedin", "x"] as const).map((plat) => (
                    <button
                      key={plat}
                      onClick={() => setActivePlatform(plat)}
                      className={`px-3 py-1 font-mono text-xs font-bold rounded-lg border-2 border-[#09090B] transition-all uppercase ${
                        activePlatform === plat
                          ? "bg-[#09090B] text-[#D2E823] shadow-hard-xs"
                          : "bg-[#F8F4E8] text-[#09090B]"
                      }`}
                    >
                      {plat === "x" ? "𝕏 (TWITTER)" : plat}
                    </button>
                  ))}
                </div>

                <div className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-4 shadow-hard-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#09090B]/20">
                    <span className="font-display text-xs uppercase font-bold text-[#09090B]">
                      {activePlatform.toUpperCase()} OPTIMIZED COPY & HASHTAGS
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(
                          platformCaptions[activePlatform] || localClip.metadata?.caption || "",
                          "post_copy"
                        )
                      }
                      className="flex items-center gap-1 bg-[#D2E823] text-[#09090B] border border-[#09090B] px-2.5 py-1 rounded font-mono text-xs font-bold shadow-hard-xs"
                    >
                      {copiedKey === "post_copy" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>COPY POST</span>
                    </button>
                  </div>

                  <div className="whitespace-pre-wrap font-mono text-xs text-[#09090B] leading-relaxed">
                    {platformCaptions[activePlatform] ||
                      localClip.metadata?.caption ||
                      `🚀 Check out this breakdown from our latest episode!\n\n"${localClip.selected_hook || localClip.hook}"\n\n#viral #creator #podcast`}
                  </div>

                  {localClip.metadata?.hashtags && localClip.metadata.hashtags.length > 0 && (
                    <div className="pt-2 border-t border-[#09090B]/10 flex flex-wrap gap-1">
                      {localClip.metadata.hashtags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="bg-[#FFFFFF] border border-[#09090B] px-1.5 py-0.5 rounded font-mono text-[10px] font-bold"
                        >
                          #{tag.replace("#", "")}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: CAPTION STUDIO */}
            {activeTab === "captions" && (
              <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1">
                {/* Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-bold text-[#09090B] uppercase flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#09090B]" />
                    <span>CAPTION THEME & STYLE</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "ACID", name: "ACID (COOK)", desc: "Yellow karaoke highlight" },
                      { id: "BOLD", name: "BOLD", desc: "Heavy white impact stroke" },
                      { id: "MINIMAL", name: "MINIMAL", desc: "Clean modern typography" },
                      { id: "CLASSIC", name: "CLASSIC", desc: "Yellow fill black border" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setCaptionStyle(s.id)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all flex flex-col gap-0.5 ${
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

                {/* Position & Active-Word Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono font-bold text-[#09090B] uppercase flex items-center gap-1.5">
                      <AlignVerticalJustifyCenter className="w-3.5 h-3.5 text-[#09090B]" />
                      <span>POSITION (9:16 SAFE AREA)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
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
                            className={`py-1.5 px-2 rounded-xl border-2 text-center text-xs font-mono font-bold uppercase transition-all flex items-center justify-center gap-1 ${
                              captionPosition === pos.id
                                ? "bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-xs"
                                : "bg-[#F8F4E8] text-[#09090B] border-[#09090B]/30 hover:border-[#09090B]"
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{pos.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-[#F8F4E8] rounded-xl border-2 border-[#09090B]">
                    <div className="space-y-0.5">
                      <span className="text-xs font-display text-[#09090B] uppercase">KARAOKE ACTIVE-WORD SYNC</span>
                      <p className="text-[10px] font-mono text-[#09090B]/70">Highlights active spoken word in #D2E823</p>
                    </div>
                    <button
                      onClick={() => setEnableActiveHighlight(!enableActiveHighlight)}
                      className={`w-11 h-6 rounded-full border-2 border-[#09090B] transition-colors relative ${
                        enableActiveHighlight ? "bg-[#D2E823]" : "bg-zinc-300"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-[#09090B] transition-transform absolute top-0.5 ${
                          enableActiveHighlight ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Phrase Editor Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold text-[#09090B] uppercase">
                      EDIT SPOKEN PHRASES ({captionPhrases.length})
                    </label>
                    <span className="text-[10px] font-mono text-[#09090B]/60 font-semibold">Click text to edit words</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 bg-[#F8F4E8] rounded-xl border-2 border-[#09090B]">
                    {captionPhrases.length === 0 ? (
                      <div className="p-4 text-center text-xs font-mono text-[#09090B]/60">
                        No phrases extracted yet. Click Re-burn to generate standard timed phrases.
                      </div>
                    ) : (
                      captionPhrases.map((phrase, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-2 bg-white rounded-lg border border-[#09090B]/30 hover:border-[#09090B] space-y-1"
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="bg-[#09090B] text-[#D2E823] px-1.5 py-0.2 rounded font-bold">
                              #{phrase.index || pIdx + 1}
                            </span>
                            <span className="text-[#09090B]/70 font-semibold">
                              {Number(phrase.start || 0).toFixed(2)}s → {Number(phrase.end || 0).toFixed(2)}s
                            </span>
                          </div>
                          <input
                            type="text"
                            value={phrase.text || ""}
                            onChange={(e) => handlePhraseTextChange(pIdx, e.target.value)}
                            className="w-full text-xs font-mono font-bold p-1.5 bg-[#F8F4E8] rounded border border-[#09090B]/30 focus:border-[#09090B] focus:outline-none"
                          />
                        </div>
                      ))
                    )}
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
              </div>
            )}

            {/* TAB 3: SEO PACKAGE */}
            {activeTab === "seo" && (
              <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1">
                <div className="space-y-2">
                  <span className="font-mono text-xs font-bold text-[#09090B]/70 uppercase">
                    5 YOUTUBE TITLE ANGLES:
                  </span>
                  <div className="space-y-1.5">
                    {[
                      { label: "CURIOSITY", title: seoPackage?.title_curiosity || localClip.selected_title || localClip.topic },
                      { label: "EDUCATIONAL", title: seoPackage?.title_educational || `How to Master ${localClip.topic}` },
                      { label: "SEARCH INTENT", title: seoPackage?.title_search || `${localClip.topic} Explained (2026 Guide)` },
                      { label: "BOLD CLAIM", title: seoPackage?.title_bold || `The Truth About ${localClip.topic}` },
                      { label: "STORY ANGLE", title: seoPackage?.title_story || `Why Everything Changed With ${localClip.topic}` },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#F8F4E8] border border-[#09090B] rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div className="flex items-center gap-2">
                          <span className="bg-[#09090B] text-[#D2E823] px-1.5 py-0.5 rounded font-bold text-[9px]">
                            {item.label}
                          </span>
                          <span className="font-bold text-[#09090B]">{item.title}</span>
                        </div>
                        <button
                          onClick={() => handleCopy(item.title, `title_${idx}`)}
                          className="p-1 rounded hover:bg-black/10"
                        >
                          {copiedKey === `title_${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {seoPackage?.description && (
                  <div className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-xs uppercase font-bold text-[#09090B]">
                        YOUTUBE TIMESTAMPED DESCRIPTION
                      </span>
                      <button
                        onClick={() => handleCopy(seoPackage.description, "seo_desc")}
                        className="p-1 rounded hover:bg-black/10"
                      >
                        {copiedKey === "seo_desc" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="font-mono text-xs whitespace-pre-wrap text-[#09090B]/80 leading-relaxed">
                      {seoPackage.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: MULTILINGUAL TRANSLATOR */}
            {activeTab === "translate" && (
              <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1">
                <div className="space-y-2">
                  <span className="font-mono text-xs font-bold text-[#09090B]/70 uppercase">
                    TRANSLATE TO 18 INDIAN & GLOBAL LANGUAGES:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleTranslate(lang.code)}
                        className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border border-[#09090B] transition-all ${
                          selectedLanguage === lang.code
                            ? "bg-[#D2E823] text-[#09090B] shadow-hard-xs font-bold"
                            : "bg-[#F8F4E8] text-[#09090B] hover:bg-[#FFFFFF]"
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Translated content card */}
                {translations && translations[selectedLanguage] ? (
                  <div className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-4 shadow-hard-xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#09090B]/20">
                      <span className="font-display text-xs uppercase text-[#09090B]">
                        {(translations[selectedLanguage]?.language || selectedLanguage).toUpperCase()} TRANSLATED METADATA
                      </span>
                      <button
                        onClick={() =>
                          handleCopy(
                            `${translations[selectedLanguage]?.hook || ""}\n\n${translations[selectedLanguage]?.caption || ""}`,
                            "trans_copy"
                          )
                        }
                        className="flex items-center gap-1 bg-[#D2E823] text-[#09090B] border border-[#09090B] px-2 py-0.5 rounded font-mono text-xs font-bold"
                      >
                        {copiedKey === "trans_copy" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>COPY</span>
                      </button>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] font-bold text-[#09090B]/60 uppercase">TRANSLATED HOOK:</span>
                        <p className="font-display text-sm font-bold text-[#09090B]">
                          &ldquo;{translations[selectedLanguage]?.hook}&rdquo;
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-[#09090B]/60 uppercase">POST CAPTION:</span>
                        <p className="whitespace-pre-wrap text-[#09090B]/80">{translations[selectedLanguage]?.caption}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center font-mono text-xs text-[#09090B]/60 bg-[#F8F4E8] rounded-xl border border-[#09090B]">
                    Click any language above to instantly generate localized hooks, subtitles, and captions.
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: WHY THIS CLIP? EXPLAINABILITY */}
            {activeTab === "explain" && (
              <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                <span className="font-mono text-xs font-bold text-[#09090B]/70 uppercase">
                  5-PILLAR AI CONTENT EXPLAINABILITY:
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: "1. OPENING TENSION", val: whyThis?.opening_hook || "Strong curiosity loop established in first 3 seconds" },
                    { label: "2. CURIOSITY LOOP", val: whyThis?.curiosity_loop || "Piques audience interest before revealing solution" },
                    { label: "3. CORE CONTEXT", val: whyThis?.core_context || "Clear context conveyed without requiring preceding video context" },
                    { label: "4. PAYOFF / INSIGHT", val: whyThis?.payoff || "High value conclusion that delivers on opening promise" },
                    { label: "5. STANDALONE VIABILITY", val: whyThis?.standalone_reason || "100% self-contained narrative suitable for cold audiences" },
                  ].map((pillar, pIdx) => (
                    <div
                      key={pIdx}
                      className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3 space-y-1 shadow-hard-xs"
                    >
                      <span className="bg-[#09090B] text-[#D2E823] px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                        {pillar.label}
                      </span>
                      <p className="font-mono text-xs text-[#09090B] pt-1">{pillar.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: THUMBNAILS */}
            {activeTab === "thumbnails" && (
              <div className="space-y-3 overflow-y-auto max-h-[460px] pr-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#09090B]/70 uppercase">
                    3 THUMBNAIL CONCEPTS EXTRACTED FROM SPEECH:
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {thumbnailCandidates.map((thumb, tIdx) => (
                    <div
                      key={tIdx}
                      className="bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3.5 space-y-2 shadow-hard-xs flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <span className="bg-[#D2E823] text-[#09090B] border border-[#09090B] px-1.5 py-0.5 rounded font-mono text-[10px] font-bold">
                          CONCEPT #{tIdx + 1}
                        </span>

                        <div className="aspect-video bg-black rounded-lg border border-[#09090B] flex items-center justify-center p-2 text-center">
                          <span className="font-display text-xs text-[#D2E823] uppercase leading-tight drop-shadow-md">
                            {thumb?.headline || "VIRAL HEADLINE"}
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px] font-mono">
                          <p className="font-bold text-[#09090B]">Visual: {thumb?.visual_concept}</p>
                          <p className="text-[#09090B]/70">Expression: {thumb?.expression}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleCopy(thumb?.headline || "", `thumb_${tIdx}`)}
                        className="w-full bg-[#FFFFFF] hover:bg-[#D2E823] border border-[#09090B] py-1 rounded font-mono text-[11px] font-bold flex items-center justify-center gap-1 mt-2"
                      >
                        <Copy className="w-3 h-3" />
                        <span>COPY OVERLAY TEXT</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: MODERATION & SAFETY CHECK */}
            {activeTab === "moderation" && (
              <div className="space-y-4 overflow-y-auto max-h-[460px] pr-1">
                <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-5 shadow-hard-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b-2 border-[#09090B]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#09090B]" />
                      <span className="font-display text-sm uppercase">AI CONTENT SAFETY CHECK</span>
                    </div>

                    <span
                      className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg border-2 border-[#09090B] ${
                        moderationReport?.safe
                          ? "bg-[#D2E823] text-[#09090B]"
                          : "bg-amber-300 text-[#09090B]"
                      }`}
                    >
                      {loadingModeration
                        ? "ANALYZING..."
                        : moderationReport?.status === "APPROVED"
                        ? "✓ 100% APPROVED"
                        : "REVIEW RECOMMENDED"}
                    </span>
                  </div>

                  <p className="font-mono text-xs text-[#09090B]/80 leading-relaxed">
                    {moderationReport?.summary ||
                      "Automated compliance check evaluating dialogue, hook, and captions across platform safety guidelines (YouTube, Meta, TikTok, LinkedIn)."}
                  </p>

                  {/* Safety Categories */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                    {[
                      { label: "HATE SPEECH", key: "hate" },
                      { label: "HARASSMENT", key: "harassment" },
                      { label: "VIOLENCE", key: "violence" },
                      { label: "DANGEROUS", key: "dangerous_instructions" },
                      { label: "EXPLICIT", key: "explicit" },
                      { label: "SPAM / SCAM", key: "spam" },
                    ].map((cat, idx) => {
                      const score = moderationReport?.category_scores?.[cat.key] || 0;
                      return (
                        <div
                          key={idx}
                          className="bg-[#F8F4E8] border border-[#09090B] rounded-xl p-2.5 space-y-1"
                        >
                          <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">
                            {cat.label}
                          </span>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-green-700">
                              {score === 0 ? "✓ CLEAN" : `${score}% RISK`}
                            </span>
                            <span className="text-[10px] font-mono text-[#09090B]/50">0%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
