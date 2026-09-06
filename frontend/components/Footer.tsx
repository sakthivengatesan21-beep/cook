import Link from "next/link";
import { Flame, ArrowUpRight } from "lucide-react";

export default function Footer() {
  return (
    <footer className="w-full bg-[#09090B] text-[#F8F4E8] border-t-2 border-[#09090B] mt-24">
      {/* Massive CTA Banner */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-20 border-b-2 border-[#1f1f23]">
        <div className="bg-[#121215] border-2 border-[#333338] rounded-2xl p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8 shadow-hard-white">
          <div className="space-y-3 text-center md:text-left">
            <span className="sticker-badge bg-[#D2E823] text-[#09090B]">
              STOP EDITING MANUALLY
            </span>
            <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl text-[#F8F4E8] tracking-tighter leading-none">
              READY TO LET IT COOK?
            </h2>
            <p className="font-body text-[#F8F4E8]/70 text-sm sm:text-base max-w-xl">
              Drop one long-form video. COOK turns it into a week of viral shorts, hooks, captions, titles and hashtags in minutes.
            </p>
          </div>

          <div className="flex-shrink-0">
            <Link
              href="/upload"
              className="btn-neo-acid text-base sm:text-lg py-4 px-8 shadow-hard-white flex items-center gap-2 group"
            >
              <span>START COOKING</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3-Column Footer Grid */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand Column */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#D2E823] rounded-lg border-2 border-[#D2E823] flex items-center justify-center text-[#09090B]">
              <Flame className="w-5 h-5 fill-[#09090B]" />
            </div>
            <span className="font-display text-2xl tracking-tighter text-[#F8F4E8]">
              COOK
            </span>
          </div>
          <p className="font-body text-xs text-[#F8F4E8]/60 leading-relaxed">
            The AI-powered short-form content engine built for modern creators. One upload. A whole content pack.
          </p>
          <div className="text-[11px] font-mono text-[#D2E823]">
            ● SYSTEM OPERATIONAL
          </div>
        </div>

        {/* Create Column */}
        <div className="space-y-3">
          <h3 className="font-mono text-xs font-bold text-[#D2E823] tracking-widest uppercase">
            CREATE
          </h3>
          <ul className="space-y-2 text-xs font-mono text-[#F8F4E8]/80">
            <li>
              <Link href="/upload" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>DROP VIDEO</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>CREATOR DASHBOARD</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/schedule" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>WEEKLY SCHEDULE</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </Link>
            </li>
          </ul>
        </div>

        {/* Resources Column */}
        <div className="space-y-3">
          <h3 className="font-mono text-xs font-bold text-[#D2E823] tracking-widest uppercase">
            RESOURCES
          </h3>
          <ul className="space-y-2 text-xs font-mono text-[#F8F4E8]/80">
            <li>
              <Link href="/#how-it-cooks" className="hover:text-[#D2E823] transition-colors">
                HOW IT COOKS
              </Link>
            </li>
            <li>
              <Link href="/#bento" className="hover:text-[#D2E823] transition-colors">
                FEATURES BENTO
              </Link>
            </li>
            <li>
              <Link href="/#moments" className="hover:text-[#D2E823] transition-colors">
                BEST MOMENTS
              </Link>
            </li>
            <li>
              <Link href="/settings" className="hover:text-[#D2E823] transition-colors">
                API & PREFERENCES
              </Link>
            </li>
          </ul>
        </div>

        {/* Social Column */}
        <div className="space-y-3">
          <h3 className="font-mono text-xs font-bold text-[#D2E823] tracking-widest uppercase">
            COMMUNITY
          </h3>
          <ul className="space-y-2 text-xs font-mono text-[#F8F4E8]/80">
            <li>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>YOUTUBE SHORTS</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </a>
            </li>
            <li>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>INSTAGRAM REELS</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </a>
            </li>
            <li>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>TIKTOK</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </a>
            </li>
            <li>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-[#D2E823] transition-colors flex items-center gap-1">
                <span>LINKEDIN</span>
                <ArrowUpRight className="w-3 h-3 opacity-60" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Legal bar */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6 border-t border-[#1f1f23] flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-[#F8F4E8]/50 gap-4">
        <div>
          © 2026 COOK. ALL RIGHTS RESERVED. BOLD NEO-BRUTALIST CREATOR SYSTEM.
        </div>
        <div className="flex items-center gap-4">
          <span>ONE VIDEO. LET IT COOK.</span>
          <span className="text-[#D2E823]">✦</span>
          <span>NO BLUR SHADOWS</span>
        </div>
      </div>
    </footer>
  );
}
