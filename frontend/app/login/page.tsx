"use client";

import React, { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Sparkles, Flame, CheckCircle2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err?.message || "Failed to initiate Google authentication. Please check configuration.");
      setLoading(false);
    }
  };

  return (
    <div className="py-12 md:py-20 px-4 flex flex-col items-center justify-center selection:bg-[#D2E823] selection:text-[#09090B]">
      <div className="w-full max-w-lg">
        <div className="bg-white border-2 border-[#09090B] rounded-2xl p-8 sm:p-10 shadow-hard-md relative overflow-hidden">
          {/* Decorative Corner Flare */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#D2E823] border-b-2 border-l-2 border-[#09090B] flex items-center justify-center -rotate-12 translate-x-8 -translate-y-8 pointer-events-none">
            <Flame className="w-6 h-6 text-[#09090B] fill-[#09090B]" />
          </div>

          {/* Badge & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#D2E823] border-2 border-[#09090B] text-xs font-mono font-bold uppercase tracking-wider mb-4 shadow-hard-xs text-[#09090B]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>SUPABASE AUTHENTICATION</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-[#09090B] leading-none mb-3">
              SIGN IN TO <span className="bg-[#D2E823] px-2 py-0.5 rounded border-2 border-[#09090B] shadow-hard-xs inline-block">COOK</span>
            </h1>
            
            <p className="text-xs sm:text-sm font-mono text-[#09090B]/70 max-w-sm mx-auto">
              Transform 1 long video into 10 viral short-form assets with active AI subtitles and weekly content schedules.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-100 border-2 border-red-500 text-red-800 text-xs font-mono font-bold shadow-hard-xs">
              {error}
            </div>
          )}

          {/* Google OAuth Button */}
          <div className="space-y-6">
            <button
              id="google-login-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="btn-neo-acid w-full h-14 text-sm shadow-hard-xs flex items-center justify-center gap-3 hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#09090B] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>CONTINUE WITH GOOGLE</span>
                </>
              )}
            </button>

            {/* Feature Bullets */}
            <div className="pt-6 border-t-2 border-[#09090B]/10 space-y-3 text-xs font-mono text-[#09090B]/80">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#D2E823] border border-[#09090B] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#09090B]" />
                </div>
                <span>Private Supabase PostgreSQL database</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#D2E823] border border-[#09090B] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#09090B]" />
                </div>
                <span>Secure Supabase Storage with signed playback URLs</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-[#D2E823] border border-[#09090B] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#09090B]" />
                </div>
                <span>Full row-level security: your video data remains isolated</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs font-mono text-[#09090B]/60 mt-6">
          ONE VIDEO. LET IT COOK. &bull; Secure Google Authentication
        </p>
      </div>
    </div>
  );
}
