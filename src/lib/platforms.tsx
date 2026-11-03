import type { Platform } from "@/types";
import type { ReactNode } from "react";
import {
  SiInstagram,
  SiX,
  SiFacebook,
  SiTiktok,
  SiPinterest,
  SiThreads,
  SiBluesky,
  SiYoutube,
} from "react-icons/si";

// LinkedIn icon (not available in Simple Icons due to trademark)
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export interface PlatformConfig {
  name: string;
  color: string;
  bgColor: string;
  icon: ReactNode;
  maxChars: number;
  features: string[];
}

const ICON_CLASS = "h-4 w-4";

export const PLATFORMS: Record<Platform, PlatformConfig> = {
  instagram: {
    name: "Instagram",
    color: "#E4405F",
    bgColor: "bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F58529]",
    icon: <SiInstagram className={ICON_CLASS} />,
    maxChars: 2200,
    features: ["Feed", "Reels", "Stories", "Carrossel"],
  },
  twitter: {
    name: "Twitter / X",
    color: "#000000",
    bgColor: "bg-black",
    icon: <SiX className={ICON_CLASS} />,
    maxChars: 280,
    features: ["Tweet", "Thread", "Poll"],
  },
  facebook: {
    name: "Facebook",
    color: "#1877F2",
    bgColor: "bg-blue-600",
    icon: <SiFacebook className={ICON_CLASS} />,
    maxChars: 63206,
    features: ["Post", "Reel", "Video", "Link"],
  },
  linkedin: {
    name: "LinkedIn",
    color: "#0A66C2",
    bgColor: "bg-sky-700",
    icon: <LinkedInIcon className={ICON_CLASS} />,
    maxChars: 3000,
    features: ["Post", "Artigo", "Company Page"],
  },
  tiktok: {
    name: "TikTok",
    color: "#000000",
    bgColor: "bg-black",
    icon: <SiTiktok className={ICON_CLASS} />,
    maxChars: 2200,
    features: ["Video", "Carousel"],
  },
  pinterest: {
    name: "Pinterest",
    color: "#E60023",
    bgColor: "bg-red-600",
    icon: <SiPinterest className={ICON_CLASS} />,
    maxChars: 500,
    features: ["Pin", "Idea Pin"],
  },
  threads: {
    name: "Threads",
    color: "#000000",
    bgColor: "bg-black",
    icon: <SiThreads className={ICON_CLASS} />,
    maxChars: 500,
    features: ["Post", "Thread"],
  },
  bluesky: {
    name: "Bluesky",
    color: "#0085FF",
    bgColor: "bg-blue-500",
    icon: <SiBluesky className={ICON_CLASS} />,
    maxChars: 300,
    features: ["Post", "Thread"],
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    bgColor: "bg-red-600",
    icon: <SiYoutube className={ICON_CLASS} />,
    maxChars: 5000,
    features: ["Video", "Short"],
  },
};

export const ALL_PLATFORMS = Object.keys(PLATFORMS) as Platform[];

export function getPlatformConfig(platform: Platform): PlatformConfig {
  return PLATFORMS[platform];
}
