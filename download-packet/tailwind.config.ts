import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./client/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        border: "#DCE1E7",
        input: "#FFFFFF",
        ring: "#2387F4",
        background: "#F2F4F7",
        foreground: "#111827",
        primary: {
          DEFAULT: "#1C2B5E",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#2387F4",
          foreground: "#FFFFFF",
        },
        destructive: {
          DEFAULT: "#F02D3A",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "#F9FAFB",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "#F02D3A",
          foreground: "#FFFFFF",
        },
        popover: {
          DEFAULT: "#FFFFFF",
          foreground: "#111827",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#111827",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;