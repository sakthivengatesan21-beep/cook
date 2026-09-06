import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F8F4E8",
        ink: "#09090B",
        acid: "#D2E823",
        "acid-light": "#E5F84D",
        "acid-dark": "#B3C815",
        surface: "#FFFFFF",
        "surface-dark": "#121215",
        card: "#FFFFFF",
      },
      fontFamily: {
        display: ["'Dela Gothic One'", "cursive", "sans-serif"],
        body: ["'Space Grotesk'", "sans-serif"],
      },
      boxShadow: {
        "hard-xs": "2px 2px 0px 0px #09090B",
        "hard-sm": "4px 4px 0px 0px #09090B",
        "hard-md": "6px 6px 0px 0px #09090B",
        "hard-lg": "8px 8px 0px 0px #09090B",
        "hard-xl": "12px 12px 0px 0px #09090B",
        "hard-acid": "4px 4px 0px 0px #D2E823",
        "hard-acid-lg": "8px 8px 0px 0px #D2E823",
        "hard-white": "4px 4px 0px 0px #FFFFFF",
        "hard-white-lg": "8px 8px 0px 0px #FFFFFF",
      },
      animation: {
        "marquee": "marquee 20s linear infinite",
        "marquee-fast": "marquee 12s linear infinite",
        "float": "float 4s ease-in-out infinite",
        "float-delayed": "float 4s ease-in-out 2s infinite",
        "glitch": "glitch 0.3s ease-in-out infinite",
        "pulse-acid": "pulseAcid 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glitch: {
          "0%": { transform: "translate(0, 0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
          "100%": { transform: "translate(0, 0)" },
        },
        pulseAcid: {
          "0%, 100%": { opacity: "1", filter: "brightness(1)" },
          "50%": { opacity: "0.85", filter: "brightness(1.2)" },
        }
      },
    },
  },
  plugins: [],
};
export default config;
