"use client";

interface MarqueeProps {
  textItems?: Array<{ text: string; highlight?: boolean }>;
  className?: string;
  speed?: "normal" | "fast";
}

export default function Marquee({
  className = "",
  speed = "normal",
}: MarqueeProps) {
  const items = [
    { text: "LET IT COOK", highlight: true },
    { text: "✦", highlight: false },
    { text: "FIND THE GOLD", highlight: false },
    { text: "✦", highlight: false },
    { text: "5 CLIPS FOUND", highlight: true },
    { text: "✦", highlight: false },
    { text: "READY TO POST", highlight: false },
    { text: "✦", highlight: false },
    { text: "ONE VIDEO → A WEEK OF CONTENT", highlight: true },
    { text: "✦", highlight: false },
    { text: "AI DOES THE CHOPPING", highlight: false },
    { text: "✦", highlight: false },
  ];

  return (
    <div
      className={`w-full overflow-hidden bg-[#09090B] border-y-2 border-[#09090B] py-3.5 select-none ${className}`}
    >
      <div
        className={`flex w-max items-center gap-6 ${
          speed === "fast" ? "animate-marquee-fast" : "animate-marquee"
        }`}
      >
        {/* Render twice for continuous loop */}
        {[...items, ...items, ...items, ...items].map((item, idx) => (
          <span
            key={idx}
            className={`font-display text-base sm:text-lg tracking-tight uppercase whitespace-nowrap ${
              item.highlight
                ? "text-[#D2E823] font-bold"
                : item.text === "✦"
                ? "text-[#D2E823]/60 text-xs"
                : "text-[#F8F4E8]"
            }`}
          >
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
