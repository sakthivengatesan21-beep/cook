import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function signInWithGoogle() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project")
  ) {
    // Development local demo login when Supabase credentials have not been configured yet
    const demoUser = {
      id: "00000000-0000-0000-0000-000000000001",
      email: "creator@cook.ai",
      user_metadata: {
        full_name: "COOK Creator",
        avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=COOK",
      },
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("cook_demo_session", JSON.stringify(demoUser));
      window.location.href = "/dashboard";
    }
    return;
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : "http://localhost:3001"}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("[SUPABASE AUTH ERROR]", error);
    throw error;
  }
  return data;
}

export async function signOut() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("cook_demo_session");
  }
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error("[SUPABASE SIGNOUT ERROR]", e);
  }
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  } catch (e) {
    // ignore
  }

  if (typeof window !== "undefined") {
    const demo = localStorage.getItem("cook_demo_session");
    if (demo) {
      try {
        const parsed = JSON.parse(demo);
        return `cook_token_${parsed.id || "00000000-0000-0000-0000-000000000001"}`;
      } catch (e) {
        return "cook_token_00000000-0000-0000-0000-000000000001";
      }
    }
  }
  return null;
}

