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
        bg: "#f5f7fa",
        "bg-deep": "#0b1524",
        ink: "#121c2b",
        muted: "#5c6b7e",
        accent: "#2b6de8",
        "accent-deep": "#1f54c4",
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
