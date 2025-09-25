import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  safelist: [
    // Sport-specific color patterns
    'bg-green-500/5', 'border-green-500/20', 'ring-green-500/40', 'ring-green-500/60',
    'bg-orange-500/5', 'border-orange-500/20', 'ring-orange-500/40', 'ring-orange-500/60',
    'bg-purple-500/5', 'border-purple-500/20', 'ring-purple-500/40', 'ring-purple-500/60',
    'bg-cyan-500/5', 'border-cyan-500/20', 'ring-cyan-500/40', 'ring-cyan-500/60',
    'bg-blue-500/5', 'border-blue-500/20', 'ring-blue-500/40', 'ring-blue-500/60',
    'bg-red-500/5', 'border-red-500/20', 'ring-red-500/40', 'ring-red-500/60',
    'bg-pink-500/5', 'border-pink-500/20', 'ring-pink-500/40', 'ring-pink-500/60',
    'bg-slate-500/5', 'border-slate-500/20', 'ring-slate-500/40', 'ring-slate-500/60',
    'bg-emerald-500/5', 'border-emerald-500/20', 'ring-emerald-500/40', 'ring-emerald-500/60',

    // Icon colors
    'text-green-500', 'border-green-500/30', 'bg-green-500/10',
    'text-orange-500', 'border-orange-500/30', 'bg-orange-500/10',
    'text-purple-500', 'border-purple-500/30', 'bg-purple-500/10',
    'text-cyan-500', 'border-cyan-500/30', 'bg-cyan-500/10',
    'text-blue-500', 'border-blue-500/30', 'bg-blue-500/10',
    'text-red-500', 'border-red-500/30', 'bg-red-500/10',
    'text-pink-500', 'border-pink-500/30', 'bg-pink-500/10',
    'text-slate-400', 'border-slate-500/30', 'bg-slate-500/10',

    // Shadow classes
    'shadow-green-500/5', 'shadow-orange-500/5', 'shadow-purple-500/5',
    'shadow-cyan-500/5', 'shadow-blue-500/5', 'shadow-red-500/5',
    'shadow-pink-500/5', 'shadow-emerald-500/5',

    // Loading skeleton classes
    'bg-green-500/20', 'bg-green-500/15',
    'bg-orange-500/20', 'bg-orange-500/15',
    'bg-purple-500/20', 'bg-purple-500/15',
    'bg-cyan-500/20', 'bg-cyan-500/15',
    'bg-blue-500/20', 'bg-blue-500/15',
    'bg-red-500/20', 'bg-red-500/15',
    'bg-pink-500/20', 'bg-pink-500/15',
    'bg-emerald-500/20', 'bg-emerald-500/15',

    // Button hover classes for alerts page
    'hover:bg-green-500/10', 'hover:border-green-500',
    'hover:bg-orange-500/10', 'hover:border-orange-500',
    'hover:bg-purple-500/10', 'hover:border-purple-500',
    'hover:bg-cyan-500/10', 'hover:border-cyan-500',
    'hover:bg-blue-500/10', 'hover:border-blue-500',
    'hover:bg-red-500/10', 'hover:border-red-500',
    'hover:bg-pink-500/10', 'hover:border-pink-500',
    'hover:bg-emerald-500/10', 'hover:border-emerald-500',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // ChirpBot V2 Color Palette
        "chirp-bg": "#F2F4F7",
        "chirp-accent-blue": "#1C2B5E",
        "chirp-cta-blue": "#2387F4",
        "chirp-alert-red": "#F02D3A",
        "chirp-border-gray": "#DCE1E7",
        "chirp-text-dark": "#111827",
        "chirp-text-muted": "#6B7280",

        // Legacy colors for compatibility
        "chirp-blue": "#1C2B5E",
        "chirp-red": "#F02D3A",
        "chirp-gray": "#F2F4F7",
        "chirp-dark": "#111827",
        "chirp-light": "#DCE1E7",
        "chirp-navy": "#0F172A",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;