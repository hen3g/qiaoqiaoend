import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#f2f6fb",
        "bg-deep": "#0b1524",
        ink: "#0f1a2a",
        muted: "#5a6b80",
        accent: "#2b6de8",
        "accent-deep": "#1f54c4",
        cyan: "#0ea5e9",
        warm: "#e8893a",
        line: "rgb(18 28 43 / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "var(--font-body)",
          "PingFang SC",
          "Noto Sans SC",
          "sans-serif",
        ],
        display: ["var(--font-display)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
