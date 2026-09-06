"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Flame, Menu, X, Sparkles, Upload, LayoutDashboard, Calendar, Video, Film, LogOut, LogIn, User } from "lucide-react";
import { useAuth } from "./AuthProvider";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  const navLinks = [
    { href: "/dashboard", label: "DASHBOARD", icon: LayoutDashboard },
    { href: "/content", label: "MY CONTENT", icon: Video },
    { href: "/edits", label: "MY EDITS", icon: Film },
    { href: "/ideas", label: "IDEA BANK", icon: Sparkles },
    { href: "/schedule", label: "SCHEDULE", icon: Calendar },
    { href: "/settings", label: "SETTINGS", icon: Sparkles },
  ];

  return (
    <header className="sticky top-4 z-50 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      <nav className="bg-[#F8F4E8]/90 backdrop-blur-xl border-2 border-[#09090B] rounded-xl shadow-hard-sm px-4 sm:px-6 py-3 flex items-center justify-between transition-all">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group cursor-pointer">
          <div className="w-9 h-9 bg-[#09090B] rounded-lg border-2 border-[#09090B] flex items-center justify-center text-[#D2E823] shadow-hard-xs group-hover:rotate-6 transition-transform">
            <Flame className="w-5 h-5 fill-[#D2E823]" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl tracking-tighter text-[#09090B] leading-none">
              COOK
            </span>
            <span className="text-[9px] font-mono tracking-widest uppercase font-bold text-[#09090B]/60 -mt-0.5">
              ONE VIDEO. LET IT COOK.
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition-all duration-150 border-2 ${
                  isActive
                    ? "bg-[#D2E823] text-[#09090B] border-[#09090B] shadow-hard-xs"
                    : "text-[#09090B] border-transparent hover:border-[#09090B] hover:bg-[#D2E823]/30 hover:shadow-hard-xs"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Primary CTA & User Profile */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/upload"
            className="btn-neo-primary text-xs py-2 px-4 shadow-hard-xs"
          >
            <span>UPLOAD</span>
            <span className="text-[#D2E823] font-bold">→</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l-2 border-[#09090B]/10">
              <div
                title={user.email}
                className="w-8 h-8 rounded-full border-2 border-[#09090B] bg-[#D2E823] flex items-center justify-center text-xs font-mono font-bold text-[#09090B] overflow-hidden shadow-hard-xs"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span>{(user.full_name || user.email || "C")[0].toUpperCase()}</span>
                )}
              </div>
              <button
                onClick={() => signOut()}
                title="Sign Out"
                className="p-1.5 rounded-lg border-2 border-transparent hover:border-[#09090B] hover:bg-red-50 text-[#09090B] transition-colors"
              >
                <LogOut className="w-4 h-4 text-red-600" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 py-2 rounded-lg border-2 border-[#09090B] bg-white hover:bg-[#D2E823] text-xs font-mono font-bold text-[#09090B] shadow-hard-xs flex items-center gap-1.5 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>SIGN IN</span>
            </Link>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg border-2 border-[#09090B] bg-[#FFFFFF] shadow-hard-xs hover:bg-[#D2E823] transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl shadow-hard-md p-4 flex flex-col gap-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg font-mono text-sm font-bold uppercase border-2 border-[#09090B] ${
                pathname === link.href
                  ? "bg-[#D2E823] shadow-hard-xs"
                  : "bg-white hover:bg-[#D2E823]"
              }`}
            >
              <link.icon className="w-4 h-4" />
              <span>{link.label}</span>
            </Link>
          ))}
          <Link
            href="/upload"
            onClick={() => setMobileMenuOpen(false)}
            className="btn-neo-primary text-center mt-2 w-full py-3"
          >
            UPLOAD VIDEO →
          </Link>

          {user ? (
            <button
              onClick={() => {
                signOut();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-2 w-full py-2.5 mt-2 rounded-lg border-2 border-red-300 bg-red-50 text-red-600 font-mono text-xs font-bold uppercase"
            >
              <LogOut className="w-4 h-4" />
              <span>SIGN OUT ({user.email})</span>
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 mt-2 rounded-lg border-2 border-[#09090B] bg-white text-[#09090B] font-mono text-xs font-bold uppercase"
            >
              <LogIn className="w-4 h-4" />
              <span>SIGN IN WITH GOOGLE</span>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
