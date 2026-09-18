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
        solix: {
          bg: "#0d0e10",
          panel: "#141518",
          sidebar: "#15171a",
          "panel-soft": "#191a1e",
          card: "#131518",
          border: "#292b30",
          "border-dark": "#303238",
          "border-light": "#3a3d43",
          text: "#eeeeec",
          muted: "#8f9299",
          label: "#666970",
          hover: "#1a1c20",
          accent: "#eeeeec",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out forwards",
        "slide-in-right": "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(3px)" },
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
