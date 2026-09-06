"use client";

import { useState } from "react";
import { Sparkles, Key, Check, Sliders, RefreshCw, Layers, ShieldCheck } from "lucide-react";
import Sticker from "@/components/Sticker";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [modelProvider, setModelProvider] = useState<"gemini" | "openai">("gemini");
  const [subtitleStyle, setSubtitleStyle] = useState<"acid" | "white">("acid");
  const [subtitlePosition, setSubtitlePosition] = useState<"lower" | "center">("lower");
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-14 w-full space-y-10">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b-2 border-[#09090B]">
        <Sticker text="ENGINE PREFERENCES" rotation="-rotate-1" variant="acid" />
        <h1 className="font-display text-4xl sm:text-6xl text-[#09090B] tracking-tighter uppercase leading-none">
          SETTINGS
        </h1>
        <p className="font-body text-[#09090B]/75 text-base font-medium">
          Configure your AI providers, video render defaults, and custom subtitle styles.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* 1. AI API Configuration */}
        <div className="neo-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b-2 border-[#09090B] pb-3">
            <Key className="w-5 h-5 text-[#09090B]" />
            <h3 className="font-display text-lg text-[#09090B] uppercase">AI ENGINE KEYS</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs font-bold text-[#09090B] uppercase">
                AI PROVIDER
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setModelProvider("gemini")}
                  className={`p-3 rounded-xl border-2 font-display text-xs uppercase transition-all ${
                    modelProvider === "gemini"
                      ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs text-[#09090B]"
                      : "bg-white border-[#09090B]/40 text-[#09090B]"
                  }`}
                >
                  GOOGLE GEMINI (1.5 FLASH)
                </button>
                <button
                  type="button"
                  onClick={() => setModelProvider("openai")}
                  className={`p-3 rounded-xl border-2 font-display text-xs uppercase transition-all ${
                    modelProvider === "openai"
                      ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs text-[#09090B]"
                      : "bg-white border-[#09090B]/40 text-[#09090B]"
                  }`}
                >
                  OPENAI (GPT-4O MINI)
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-xs font-bold text-[#09090B] uppercase flex items-center justify-between">
                <span>API KEY (OPTIONAL - BUILT-IN FALLBACK ACTIVE)</span>
                <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-700">
                  ● ACTIVE
                </span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-... or AIzaSy..."
                className="w-full p-3 rounded-xl border-2 border-[#09090B] font-mono text-xs bg-[#F8F4E8] focus:bg-white focus:outline-none"
              />
              <p className="text-[11px] font-mono text-[#09090B]/60">
                If left empty, COOK uses our high-retention rule-based heuristic creator engine automatically.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Subtitle & Video Render Settings */}
        <div className="neo-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b-2 border-[#09090B] pb-3">
            <Sliders className="w-5 h-5 text-[#09090B]" />
            <h3 className="font-display text-lg text-[#09090B] uppercase">
              SUBTITLE & VIDEO DEFAULTS
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-mono text-xs font-bold text-[#09090B] uppercase">
                SUBTITLE ACCENT COLOR
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubtitleStyle("acid")}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    subtitleStyle === "acid"
                      ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs text-[#09090B]"
                      : "bg-white border-[#09090B]/30"
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-[#D2E823] border border-[#09090B]" />
                  <span>ACID YELLOW</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubtitleStyle("white")}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    subtitleStyle === "white"
                      ? "bg-[#09090B] text-[#F8F4E8] border-[#09090B] shadow-hard-xs"
                      : "bg-white border-[#09090B]/30"
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-white border border-[#09090B]" />
                  <span>INK WHITE</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-mono text-xs font-bold text-[#09090B] uppercase">
                SUBTITLE POSITION
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSubtitlePosition("lower")}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold transition-all ${
                    subtitlePosition === "lower"
                      ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs text-[#09090B]"
                      : "bg-white border-[#09090B]/30"
                  }`}
                >
                  LOWER THIRD (DEFAULT)
                </button>
                <button
                  type="button"
                  onClick={() => setSubtitlePosition("center")}
                  className={`p-2.5 rounded-xl border-2 font-mono text-xs font-bold transition-all ${
                    subtitlePosition === "center"
                      ? "bg-[#D2E823] border-[#09090B] shadow-hard-xs text-[#09090B]"
                      : "bg-white border-[#09090B]/30"
                  }`}
                >
                  CENTER STACK
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Save CTA */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn-neo-primary text-base py-3.5 px-8 shadow-hard-md flex items-center gap-2"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-[#D2E823]" />
                <span>PREFERENCES SAVED</span>
              </>
            ) : (
              <span>SAVE PREFERENCES →</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
