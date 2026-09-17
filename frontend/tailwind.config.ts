import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#07090e",
        foreground: "#f8fafc",
        glass: {
          50: "rgba(255, 255, 255, 0.02)",
          100: "rgba(255, 255, 255, 0.04)",
          200: "rgba(255, 255, 255, 0.07)",
          300: "rgba(255, 255, 255, 0.10)",
          border: "rgba(255, 255, 255, 0.08)",
          "border-hover": "rgba(255, 255, 255, 0.16)",
          "border-active": "rgba(56, 189, 248, 0.3)",
        },
        surface: {
          base: "#07090e",
          raised: "#0d111a",
          overlay: "#111726",
        },
        brand: {
          cyan: "#06b6d4",
          sky: "#38bdf8",
          blue: "#3b82f6",
          violet: "#8b5cf6",
          purple: "#a855f7",
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-sm": "0 4px 16px 0 rgba(0, 0, 0, 0.25)",
        "glass-lg": "0 16px 48px 0 rgba(0, 0, 0, 0.5)",
        "glow-cyan": "0 0 24px -4px rgba(6, 182, 212, 0.35)",
        "glow-violet": "0 0 24px -4px rgba(139, 92, 246, 0.35)",
      },
      backdropBlur: {
        xs: "2px",
        "2xl": "24px",
        "3xl": "32px",
      },
      animation: {
        "ambient-pulse": "ambientPulse 12s ease-in-out infinite alternate",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.25s ease-out forwards",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        ambientPulse: {
          "0%": { transform: "translate(0, 0) scale(1)", opacity: "0.4" },
          "50%": { transform: "translate(30px, -20px) scale(1.08)", opacity: "0.6" },
          "100%": { transform: "translate(-20px, 20px) scale(0.95)", opacity: "0.4" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;

