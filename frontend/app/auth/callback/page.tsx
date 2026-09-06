"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Flame } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FF5500] to-[#FF8800] p-0.5 animate-pulse mb-4">
        <div className="w-full h-full bg-[#0B0F19] rounded-[14px] flex items-center justify-center">
          <Flame className="w-6 h-6 text-[#FF5500] fill-[#FF5500]" />
        </div>
      </div>
      <p className="text-sm font-mono text-gray-400">Authenticating with Google & Supabase...</p>
    </div>
  );
}
