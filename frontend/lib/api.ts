import {
  Video,
  Clip,
  VideoDetailResponse,
  ScheduleItem,
  ProcessingStatusResponse,
  ContentGenomeMoment,
  RemixTreeNode,
  AskVideoResponse,
  AudioIntelligenceReport
} from "@/types";
import { getAccessToken } from "./supabase";

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Local development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${hostname}:8000`;
    }
    // On Vercel or cloud production without explicit NEXT_PUBLIC_API_URL,
    // use relative path so requests route through Next.js proxy rewrites without HTTP 8000 mixed-content errors.
    return "";
  }
  return process.env.BACKEND_URL ? process.env.BACKEND_URL.replace(/\/+$/, "") : "http://127.0.0.1:8000";
}

export const API_BASE = getApiBaseUrl();

export async function checkBackendHealth(): Promise<{ online: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/`, { method: "GET", cache: "no-store" });
    if (res.ok) {
      return { online: true };
    }
    return { online: false, message: `Server returned HTTP ${res.status}` };
  } catch (err: any) {
    return { online: false, message: err.message || "Failed to connect to COOK backend server." };
  }
}

export interface UploadProgressCallback {
  (loadedBytes: number, totalBytes: number, percent: number): void;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function uploadVideo(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<{ success: boolean; video_id: string; job_id: string; video: Video; warning?: string }> {
  const token = await getAccessToken();
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(event.loaded, event.total, percent);
      }
    });

    xhr.addEventListener("load", () => {
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(xhr.responseText);
      } catch {
        responseJson = { detail: xhr.responseText || "Upload response could not be parsed." };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(responseJson);
      } else if (xhr.status === 413) {
        reject(new Error(responseJson.detail || "VIDEO TOO LARGE. Maximum supported size is 250 MB."));
      } else if (xhr.status === 400) {
        reject(new Error(responseJson.detail || "UNSUPPORTED OR CORRUPTED VIDEO. Please upload a valid MP4, MOV, or WebM video."));
      } else if (xhr.status === 401) {
        reject(new Error("Authentication required. Please login with Google to upload."));
      } else {
        reject(new Error(responseJson.detail || `Upload failed (HTTP ${xhr.status}).`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("UPLOAD INTERRUPTED. Check your connection or ensure the COOK backend is accessible."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted by user."));
    });

    xhr.open("POST", `${API_BASE}/api/upload`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.send(formData);
  });
}

export async function startProcessing(videoId: string): Promise<{ success: boolean; video_id: string; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/process/${videoId}`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to start cooking" }));
    throw new Error(err.detail || "Failed to start cooking process");
  }

  return res.json();
}

export async function retryProcessing(videoId: string): Promise<{ success: boolean; video_id: string; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/process/${videoId}/retry`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to retry cooking" }));
    throw new Error(err.detail || "Failed to retry cooking process");
  }

  return res.json();
}

export async function getProcessingStatus(videoId: string): Promise<ProcessingStatusResponse> {
  const res = await fetch(`${API_BASE}/api/process/${videoId}/status`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to check status");
  }

  return res.json();
}

export async function listVideos(): Promise<Video[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function getDashboardData(): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/dashboard`, { headers, cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function getLibrary(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/library`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function getEdits(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/edits`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function getVideoDetail(videoId: string): Promise<VideoDetailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}`, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch video details");
  }
  return res.json();
}

export async function deleteVideo(videoId: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    throw new Error("Failed to delete video");
  }
  const data = await res.json();
  return data.success;
}

export async function getClips(videoId: string): Promise<Clip[]> {
  const res = await fetch(`${API_BASE}/api/clips/${videoId}`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json();
}

export async function getClipItem(clipId: string): Promise<Clip> {
  const res = await fetch(`${API_BASE}/api/clips/single/${clipId}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load clip details");
  }
  return res.json();
}

export async function updateClip(
  clipId: string,
  updateData: {
    selected_hook?: string;
    selected_title?: string;
    caption?: string;
    hashtags?: string[];
  }
): Promise<Clip> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updateData),
  });

  if (!res.ok) {
    throw new Error("Failed to update clip metadata");
  }

  const data = await res.json();
  return data.clip;
}

export async function burnCaptions(
  clipId: string,
  options: {
    style?: string;
    position?: string;
    language?: string;
    phrases?: any[];
    enable_active_highlight?: boolean;
  }
): Promise<{ success: boolean; clip: Clip; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/burn-captions`, {
    method: "POST",
    headers,
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Caption rendering failed." }));
    throw new Error(err.detail || "Failed to burn subtitles into video.");
  }

  return res.json();
}

export const burnClipCaptions = burnCaptions;

export async function regenerateClip(
  clipId: string,
  startTime?: number,
  endTime?: number
): Promise<{ success: boolean; clip: Clip }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/regenerate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ start_time: startTime, end_time: endTime }),
  });
  if (!res.ok) {
    const clip = await getClipItem(clipId);
    return { success: true, clip };
  }
  return res.json();
}

// -------------------------------------------------------------
// STANDOUT FEATURES API CLIENT METHODS
// -------------------------------------------------------------

export async function getContentGenome(videoId: string): Promise<ContentGenomeMoment[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/genome`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.genome || [];
}

export async function getRemixTree(videoId: string): Promise<RemixTreeNode | null> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/remix-tree`, { headers, cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.tree || null;
}

export async function askVideo(videoId: string, query: string): Promise<AskVideoResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/ask`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to query video content." }));
    throw new Error(err.detail || "Failed to query video content.");
  }
  return res.json();
}

export async function searchVideo(videoId: string, query: string): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/search?q=${encodeURIComponent(query)}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

export async function getAudioIntelligence(videoId: string): Promise<AudioIntelligenceReport> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/audio-intelligence`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to analyze audio." }));
    throw new Error(err.detail || "Failed to analyze audio.");
  }
  const data = await res.json();
  return data.report;
}

export async function trimClipSilence(
  clipId: string,
  thresholdSeconds: number = 1.2,
  removeFillers: boolean = false
): Promise<{ success: boolean; clip: Clip; message: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/silence-trim`, {
    method: "POST",
    headers,
    body: JSON.stringify({ threshold_seconds: thresholdSeconds, remove_fillers: removeFillers }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Silence trimming failed." }));
    throw new Error(err.detail || "Silence trimming failed.");
  }
  return res.json();
}

export async function translateClip(
  clipId: string,
  targetLanguage: string
): Promise<{ success: boolean; translation: any; clip: Clip }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/translate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ target_language: targetLanguage }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Translation failed." }));
    throw new Error(err.detail || "Translation failed.");
  }
  return res.json();
}

export async function remixClipAspect(
  clipId: string,
  targetAspect: "1:1" | "16:9" | "9:16"
): Promise<{ success: boolean; clip: Clip; aspect: string; url: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/remix`, {
    method: "POST",
    headers,
    body: JSON.stringify({ target_aspect: targetAspect }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Aspect remix failed." }));
    throw new Error(err.detail || "Aspect remix failed.");
  }
  return res.json();
}

export async function generateClipThumbnails(
  clipId: string
): Promise<{ success: boolean; thumbnails: any[]; clip: Clip }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/thumbnails`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Thumbnail generation failed." }));
    throw new Error(err.detail || "Thumbnail generation failed.");
  }
  return res.json();
}

export function getDownloadZipUrl(videoId: string): string {
  return `${API_BASE}/api/download/${videoId}/zip`;
}

export const getExportPackUrl = getDownloadZipUrl;

export function getClipDownloadUrl(clipId: string, type: "captioned" | "vertical" | "raw" = "captioned"): string {
  return `${API_BASE}/outputs/${clipId}_${type}.mp4`;
}

export function getClipSrtUrl(clipId: string): string {
  return `${API_BASE}/outputs/${clipId}_subtitles.srt`;
}

export function getClipAssUrl(clipId: string): string {
  return `${API_BASE}/outputs/${clipId}_subtitles.ass`;
}

export async function setupDemoVideo(): Promise<{ success: boolean; video_id: string; job_id: string; video: Video }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/demo`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    return {
      success: true,
      video_id: "demo_cook_master_01",
      job_id: "demo_cook_master_01",
      video: {
        id: "demo_cook_master_01",
        filename: "COOK_Master_Podcast_Ep01.mp4",
        storage_url: "/uploads/cook_sample_podcast.mp4",
        duration: 60.0,
        file_size: 48,
        status: "completed",
        status_message: "Your content is cooked and ready to serve!",
        progress: 100,
        created_at: new Date().toISOString(),
      },
    };
  }
  return res.json();
}

// -------------------------------------------------------------
// IDEA BANK & BROWSER EXTENSION API METHODS
// -------------------------------------------------------------

export async function getIdeas(): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/ideas`, { headers, cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.ideas || [];
}

export async function createIdea(ideaData: {
  title: string;
  url?: string;
  platform?: string;
  notes?: string;
  creator?: string;
  tags?: string[];
}): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/ideas`, {
    method: "POST",
    headers,
    body: JSON.stringify(ideaData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Failed to create idea." }));
    throw new Error(err.detail || "Failed to create idea.");
  }
  const data = await res.json();
  return data.idea;
}

export async function deleteIdea(ideaId: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/ideas/${ideaId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.success;
}

export async function generateIdeaAngles(text: string, platform = "general"): Promise<string[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/ideas/generate-angles`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, platform }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.generated_angles || [];
}

// -------------------------------------------------------------
// MODERATION & SAFETY CHECK API METHODS
// -------------------------------------------------------------

export async function getClipModeration(clipId: string): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/clips/${clipId}/moderation`, {
    method: "POST",
    headers,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.moderation || null;
}

export async function getVideoModeration(videoId: string): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/moderation`, {
    method: "POST",
    headers,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.moderation || null;
}

// -------------------------------------------------------------
// SCHEDULE API METHODS
// -------------------------------------------------------------

export async function updateScheduleItem(
  scheduleId: string,
  updateData: {
    scheduled_date?: string;
    scheduled_time?: string;
    status?: string;
    platform?: string;
  }
): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/schedule/${scheduleId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updateData),
  });
  if (!res.ok) {
    throw new Error("Failed to update schedule item.");
  }
  const data = await res.json();
  return data.schedule_item;
}

