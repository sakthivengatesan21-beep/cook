"use client";

import React, { useState } from "react";
import { RemixTreeNode } from "@/types";
import { GitFork, Video, Scissors, FileText, Globe, Layers, Sparkles, ChevronDown, ChevronRight, Share2, Search } from "lucide-react";

interface ContentRemixTreeProps {
  tree: RemixTreeNode | null;
  onSelectNode?: (node: RemixTreeNode) => void;
}

export default function ContentRemixTree({ tree, onSelectNode }: ContentRemixTreeProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  const [activeNode, setActiveNode] = useState<RemixTreeNode | null>(null);

  if (!tree) {
    return (
      <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-6 shadow-hard-md text-[#09090B] space-y-4">
        <div className="flex items-center gap-2">
          <GitFork className="w-5 h-5 text-[#09090B]" />
          <h3 className="font-display text-lg tracking-tight uppercase">CONTENT REMIX TREE</h3>
        </div>
        <div className="p-8 text-center font-mono text-sm text-[#09090B]/60 bg-[#F8F4E8] rounded-xl border-2 border-dashed border-[#09090B]/30">
          Upload and cook a video to generate your visual multi-platform remix tree.
        </div>
      </div>
    );
  }

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleNodeClick = (node: RemixTreeNode) => {
    setActiveNode(node);
    if (onSelectNode) {
      onSelectNode(node);
    }
  };

  const getNodeIcon = (type: string, name: string) => {
    switch (type) {
      case "root":
        return Video;
      case "category":
        return Layers;
      case "clip":
        return Scissors;
      case "asset":
        if (name.includes("Language") || name.includes("Translation")) return Globe;
        if (name.includes("SEO") || name.includes("Search")) return Search;
        if (name.includes("Post") || name.includes("Social")) return Share2;
        return FileText;
      default:
        return Sparkles;
    }
  };

  const renderNode = (node: RemixTreeNode, depth = 0) => {
    const isCollapsed = collapsedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const Icon = getNodeIcon(node.type, node.name);
    const isSelected = activeNode?.id === node.id;

    return (
      <div key={node.id} className="relative pl-6 my-2">
        {/* Left branch line */}
        {depth > 0 && (
          <div className="absolute -left-0 top-4 w-6 h-[2px] bg-[#09090B]" />
        )}
        {depth > 0 && (
          <div className="absolute -left-0 -top-2 bottom-4 w-[2px] bg-[#09090B]" />
        )}

        <div
          onClick={() => handleNodeClick(node)}
          className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 border-[#09090B] cursor-pointer transition-all duration-150 ${
            node.type === "root"
              ? "bg-[#D2E823] text-[#09090B] font-display text-sm shadow-hard-xs"
              : node.type === "category"
              ? "bg-[#09090B] text-[#F8F4E8] font-mono text-xs font-bold shadow-hard-xs"
              : node.type === "clip"
              ? "bg-[#FFFFFF] text-[#09090B] font-display text-xs hover:bg-[#F8F4E8] shadow-hard-xs"
              : "bg-[#F8F4E8] text-[#09090B] font-mono text-[11px] hover:bg-[#FFFFFF]"
          } ${isSelected ? "ring-4 ring-[#D2E823] scale-[1.02]" : ""}`}
        >
          {hasChildren && (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              className="p-0.5 rounded hover:bg-black/10 text-current"
            >
              {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate max-w-[280px]">{node.name}</span>

          {hasChildren && (
            <span className="text-[10px] font-mono opacity-70 bg-black/10 px-1.5 py-0.2 rounded-full">
              {node.children!.length}
            </span>
          )}
        </div>

        {/* Children Nodes */}
        {hasChildren && !isCollapsed && (
          <div className="ml-2 border-l-2 border-[#09090B] pl-2 space-y-1">
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#FFFFFF] border-3 border-[#09090B] rounded-2xl p-6 shadow-hard-md text-[#09090B] space-y-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b-2 border-[#09090B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center shadow-hard-xs">
            <GitFork className="w-5 h-5 text-[#09090B]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg tracking-tight uppercase">CONTENT REMIX TREE</h3>
              <span className="bg-[#09090B] text-[#D2E823] text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                1 VIDEO $\rightarrow$ 30+ ASSETS
              </span>
            </div>
            <p className="text-xs font-mono text-[#09090B]/70">
              Interactive relationship map showing how your raw video multiplies into clips, copy, SEO, and translations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="bg-[#F8F4E8] border border-[#09090B] px-2.5 py-1 rounded-lg">
            CLICK ANY NODE TO INSPECT
          </span>
        </div>
      </div>

      {/* Tree View Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 overflow-x-auto p-4 bg-[#F8F4E8] rounded-xl border-2 border-[#09090B] max-h-[500px] overflow-y-auto">
          {renderNode(tree)}
        </div>

        {/* Selected Node Details Drawer */}
        <div className="bg-[#FFFFFF] border-2 border-[#09090B] rounded-xl p-4 shadow-hard-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b-2 border-[#09090B]">
              <span className="font-display text-xs uppercase tracking-tight text-[#09090B]/80">
                NODE INSPECTOR
              </span>
              <span className="font-mono text-[10px] bg-[#D2E823] px-2 py-0.5 rounded font-bold border border-[#09090B]">
                {activeNode?.type?.toUpperCase() || "ROOT"}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#09090B]/60 uppercase">TITLE / LABEL</span>
                <p className="font-display text-sm uppercase text-[#09090B]">
                  {activeNode ? activeNode.name : tree.name}
                </p>
              </div>

              {activeNode?.data ? (
                <div className="space-y-2 text-xs font-mono bg-[#F8F4E8] p-3 rounded-lg border border-[#09090B]">
                  <span className="font-bold text-[10px] uppercase text-[#09090B]/60">PAYLOAD DATA:</span>
                  <pre className="text-[10px] whitespace-pre-wrap break-all text-[#09090B]/80">
                    {JSON.stringify(activeNode.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-xs font-mono text-[#09090B]/70 bg-[#F8F4E8] p-3 rounded-lg border border-[#09090B]">
                  Select any child node (Clip, Post, SEO, or Translation) in the tree to preview its generated contents and direct action shortcuts.
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#09090B]/10">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#09090B]/80">
              <span>Auto-generated by COOK Engine</span>
              <span className="font-bold text-[#09090B]">100% REAL SPEECH</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
