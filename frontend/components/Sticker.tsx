interface StickerProps {
  text: string;
  rotation?: string;
  variant?: "acid" | "dark" | "white";
  className?: string;
  icon?: React.ReactNode;
}

export default function Sticker({
  text,
  rotation = "-rotate-2",
  variant = "acid",
  className = "",
  icon,
}: StickerProps) {
  const variantStyles = {
    acid: "bg-[#D2E823] text-[#09090B] border-[#09090B] shadow-hard-xs",
    dark: "bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-xs",
    white: "bg-[#FFFFFF] text-[#09090B] border-[#09090B] shadow-hard-xs",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 font-display text-[11px] sm:text-xs tracking-tight uppercase select-none transition-transform hover:scale-105 ${rotation} ${variantStyles[variant]} ${className}`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
