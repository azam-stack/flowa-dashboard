import type { Config } from "tailwindcss";

/**
 * Two deliberately separate palettes:
 * - `brand` (orange-led) carries Flowa's identity: chrome, buttons, active nav, illustration.
 * - `status` (green/blue/red) carries meaning: on-track / needs-attention / critical.
 * They must never be reached for interchangeably — `brand.500` is never a warning color,
 * and `status.warning` is never used for decoration.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FDF6EC",
          100: "#FBEAD2",
          200: "#F6D3A3",
          300: "#F1BC79",
          400: "#F1AC5C",
          500: "#EE9E47", // Flowa orange — the identity color
          600: "#D9822C",
          700: "#B4661F",
          800: "#8C4F1B",
          900: "#6B3D18",
        },
        ink: {
          50: "#F7F5F2",
          100: "#EDE8E1",
          200: "#D9D0C4",
          300: "#B7A992",
          400: "#7A6952", // darkened from the original tone so small muted text still clears AA contrast on white
          500: "#6B5B48",
          600: "#4E4130",
          700: "#3A3024",
          800: "#2A2219",
          900: "#1C1610", // near-black warm ink, primary text
        },
        cream: {
          DEFAULT: "#FBF7F0",
          50: "#FFFFFF",
          100: "#FBF7F0",
          200: "#F4EDE1",
        },
        status: {
          good: "#116649", // sund / on track — darkened from the original teal for AA contrast on white
          "good-bg": "#E4F4EE",
          warn: "#3568C6", // advarsel / needs attention — deliberately blue, never orange
          "warn-bg": "#E7EEFB",
          crit: "#C4433A", // kritisk
          "crit-bg": "#FBEAE8",
          stale: "#71614C", // udsat / snoozed / stale
          "stale-bg": "#F2EDE4",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        blob: "63% 37% 54% 46% / 45% 41% 59% 55%",
        xl2: "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28, 22, 16, 0.04), 0 8px 24px -12px rgba(28, 22, 16, 0.12)",
        card: "0 1px 1px rgba(28, 22, 16, 0.03), 0 2px 8px rgba(28, 22, 16, 0.06)",
      },
      keyframes: {
        "flash-in": {
          "0%": { backgroundColor: "rgba(238,158,71,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "rise-fade": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "flash-in": "flash-in 1.4s ease-out",
        "rise-fade": "rise-fade 0.25s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
