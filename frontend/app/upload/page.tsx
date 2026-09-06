"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Film, FileVideo, AlertCircle, Sparkles, CheckCircle2, ArrowRight, Zap, VolumeX } from "lucide-react";
import Sticker from "@/components/Sticker";
import { uploadVideo, startProcessing, setupDemoVideo } from "@/lib/api";

const MAX_FILE_SIZE_MB = 250;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const VALID_EXTENSIONS = [".mp4", ".mov", ".webm"];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadStage, setUploadStage] = useState<"idle" | "uploading" | "saved" | "cooking">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setAudioWarning(null);

    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();

    // 1. Format Validation
    if (!VALID_EXTENSIONS.includes(fileExt)) {
      setErrorMessage(
        `UNSUPPORTED VIDEO: Please upload MP4, MOV, or WebM. (Received: ${fileExt || "unknown"})`
      );
      return;
    }

    // 2. Size Validation (250 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        `FILE TOO LARGE: Maximum supported size is ${MAX_FILE_SIZE_MB} MB. Your file is ${fileSizeMB} MB.`
      );
      return;
    }

    setSelectedFile(file);
    setTotalBytes(file.size);

    // Calculate local video duration using a temporary Object URL
    try {
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      tempVideo.onloadedmetadata = () => {
        setVideoDuration(tempVideo.duration);
        URL.revokeObjectURL(tempVideo.src);
      };
      tempVideo.src = URL.createObjectURL(file);
    } catch {
      setVideoDuration(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartCooking = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadStage("uploading");
      setErrorMessage(null);
      setAudioWarning(null);

      // 1. Upload File with live byte-level progress
      const uploadRes = await uploadVideo(selectedFile, (loaded, total, percent) => {
        setLoadedBytes(loaded);
        setTotalBytes(total);
        setUploadPercent(percent);
      });

      setUploadStage("saved");

      if (uploadRes.warning || (uploadRes.video && !uploadRes.video.has_audio)) {
        setAudioWarning(
          "NO AUDIO DETECTED: COOK needs spoken audio for transcription and content analysis."
        );
      }

      // 2. Trigger Processing in separate request
      setUploadStage("cooking");
      await startProcessing(uploadRes.video_id);

      // 3. Redirect to processing page
      setTimeout(() => {
        router.push(`/processing?id=${uploadRes.video_id}`);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || "Upload failed. Please check the video and try again.");
      setIsUploading(false);
      setUploadStage("idle");
    }
  };

  const handleLaunchSampleDemo = async () => {
    try {
      setLoadingDemo(true);
      const res = await setupDemoVideo();
      router.push(`/processing?id=${res.video_id}`);
    } catch (err: any) {
      setErrorMessage("Failed to start demo video. Please try again.");
    } finally {
      setLoadingDemo(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return (bytes / 1024).toFixed(1) + " KB";
    }
    return mb.toFixed(1) + " MB";
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10 sm:py-16 w-full flex flex-col items-center">
      {/* Header */}
      <div className="text-center space-y-4 mb-10">
        <Sticker text="STAGE 01 — UPLOAD" rotation="-rotate-1" variant="acid" />
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl text-[#09090B] tracking-tighter uppercase leading-none">
          DROP IT IN.
        </h1>
        <p className="font-body text-[#09090B]/75 text-base sm:text-lg max-w-lg mx-auto font-medium">
          Give COOK something to work with. Supports up to 250 MB videos (3–10+ minutes).
        </p>
      </div>

      {/* Main Drag & Drop Zone */}
      <div className="w-full neo-card p-6 sm:p-10 flex flex-col items-center text-center relative overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelect(e.target.files[0]);
            }
          }}
        />

        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-16 px-6 border-4 border-dashed rounded-2xl flex flex-col items-center justify-center space-y-5 cursor-pointer transition-all ${
              isDragging
                ? "border-[#09090B] bg-[#D2E823]/30 scale-[1.01]"
                : "border-[#09090B]/40 hover:border-[#09090B] bg-[#F8F4E8]/50 hover:bg-[#F8F4E8]"
            }`}
          >
            <div className="w-20 h-20 rounded-2xl bg-[#09090B] text-[#D2E823] flex items-center justify-center border-2 border-[#09090B] shadow-hard-xs transform -rotate-3 group-hover:rotate-0 transition-transform">
              <Upload className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-display text-2xl sm:text-3xl text-[#09090B] uppercase tracking-tight">
                DROP VIDEO HERE
              </h3>
              <p className="font-body text-sm text-[#09090B]/70 font-semibold">
                or <span className="text-[#09090B] underline font-bold">browse your files</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-bold bg-white px-3.5 py-1.5 rounded-full border border-[#09090B] shadow-hard-xs">
              <span>MP4</span>
              <span>·</span>
              <span>MOV</span>
              <span>·</span>
              <span>WEBM</span>
              <span className="text-[#09090B]/40">|</span>
              <span className="text-[#09090B]">UP TO 250 MB</span>
            </div>
          </div>
        ) : (
          /* File Selected Card */
          <div className="w-full space-y-6">
            <div className="p-6 bg-[#F8F4E8] rounded-2xl border-2 border-[#09090B] flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-hard-xs">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#D2E823] text-[#09090B] flex items-center justify-center border-2 border-[#09090B] flex-shrink-0">
                  <Film className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display text-lg text-[#09090B] tracking-tight uppercase line-clamp-1">
                    {selectedFile.name}
                  </h4>
                  <div className="flex items-center gap-3 text-xs font-mono font-bold text-[#09090B]/70">
                    <span>{formatFileSize(selectedFile.size)}</span>
                    {videoDuration && (
                      <>
                        <span>·</span>
                        <span>DURATION: {formatDuration(videoDuration)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!isUploading && (
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-xs font-mono font-bold uppercase underline hover:text-red-600 transition-colors"
                >
                  CHANGE FILE
                </button>
              )}
            </div>

            {/* Real Upload Progress Bar with Megabytes */}
            {isUploading && (
              <div className="space-y-2 text-left bg-[#FFFFFF] p-4 rounded-xl border-2 border-[#09090B]">
                <div className="flex justify-between items-center text-xs font-mono font-bold">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#09090B] animate-ping" />
                    {uploadStage === "uploading"
                      ? "UPLOADING VIDEO..."
                      : uploadStage === "saved"
                      ? "UPLOAD COMPLETE ✓"
                      : "STARTING COOKING ENGINE..."}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#09090B]/70">
                      {formatFileSize(loadedBytes)} / {formatFileSize(totalBytes || selectedFile.size)}
                    </span>
                    <span className="font-display text-sm bg-[#D2E823] px-2 py-0.5 rounded border border-[#09090B]">
                      {uploadPercent}%
                    </span>
                  </div>
                </div>

                <div className="h-4 w-full bg-[#09090B]/10 rounded-full border-2 border-[#09090B] overflow-hidden">
                  <div
                    className="h-full bg-[#D2E823] border-r-2 border-[#09090B] transition-all duration-150"
                    style={{ width: `${uploadPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Audio Warning Message */}
            {audioWarning && (
              <div className="p-4 bg-amber-100 border-2 border-amber-600 rounded-xl text-amber-950 text-xs font-mono font-bold flex items-center gap-2 text-left">
                <VolumeX className="w-5 h-5 text-amber-700 flex-shrink-0" />
                <span>{audioWarning}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleStartCooking}
              disabled={isUploading}
              className="btn-neo-primary text-base sm:text-lg py-4 px-10 w-full shadow-hard-md flex items-center justify-center gap-3"
            >
              <span>
                {isUploading
                  ? uploadStage === "cooking"
                    ? "PREPARING INGREDIENTS..."
                    : "UPLOADING..."
                  : "LET IT COOK"}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-4 p-4 bg-red-100 border-2 border-red-500 rounded-xl text-red-900 text-xs font-mono font-bold flex items-center gap-2 w-full text-left">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Or Quick Demo Trigger */}
        <div className="mt-8 pt-8 border-t-2 border-[#09090B]/20 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left space-y-0.5">
            <span className="font-display text-sm text-[#09090B] uppercase">NO VIDEO READY?</span>
            <p className="font-body text-xs text-[#09090B]/70 font-medium">
              Run COOK on our pre-packaged creator sample video instantly.
            </p>
          </div>

          <button
            onClick={handleLaunchSampleDemo}
            disabled={loadingDemo || isUploading}
            className="btn-neo-secondary text-xs py-2.5 px-5 shadow-hard-xs flex items-center gap-2 whitespace-nowrap"
          >
            <Zap className="w-4 h-4 fill-[#09090B]" />
            <span>{loadingDemo ? "LAUNCHING..." : "TRY SAMPLE DEMO"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
