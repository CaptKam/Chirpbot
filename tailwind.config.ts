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

    // Hover/interaction classes for settings sport colors
    'hover:bg-green-500/10', 'hover:bg-green-500/20', 'hover:border-green-500', 'hover:ring-green-500/30', 'group-hover:text-green-400', 'data-[state=checked]:bg-green-500', 'ring-green-500/30', 'border-green-500', 'text-green-400',
    'hover:bg-orange-500/10', 'hover:bg-orange-500/20', 'hover:border-orange-500', 'hover:ring-orange-500/30', 'group-hover:text-orange-400', 'data-[state=checked]:bg-orange-500', 'ring-orange-500/30', 'border-orange-500', 'text-orange-400',
    'hover:bg-purple-500/10', 'hover:bg-purple-500/20', 'hover:border-purple-500', 'hover:ring-purple-500/30', 'group-hover:text-purple-400', 'data-[state=checked]:bg-purple-500', 'ring-purple-500/30', 'border-purple-500', 'text-purple-400',
    'hover:bg-cyan-500/10', 'hover:bg-cyan-500/20', 'hover:border-cyan-500', 'hover:ring-cyan-500/30', 'group-hover:text-cyan-400', 'data-[state=checked]:bg-cyan-500', 'ring-cyan-500/30', 'border-cyan-500', 'text-cyan-400',
    'hover:bg-blue-500/10', 'hover:bg-blue-500/20', 'hover:border-blue-500', 'hover:ring-blue-500/30', 'group-hover:text-blue-400', 'data-[state=checked]:bg-blue-500', 'ring-blue-500/30', 'border-blue-500', 'text-blue-400',
    'hover:bg-red-500/10', 'hover:bg-red-500/20', 'hover:border-red-500', 'hover:ring-red-500/30', 'group-hover:text-red-400', 'data-[state=checked]:bg-red-500', 'ring-red-500/30', 'border-red-500', 'text-red-400',
    'hover:bg-pink-500/10', 'hover:bg-pink-500/20', 'hover:border-pink-500', 'hover:ring-pink-500/30', 'group-hover:text-pink-400', 'data-[state=checked]:bg-pink-500', 'ring-pink-500/30', 'border-pink-500', 'text-pink-400',
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // ── Chirp.bet V3 Design System ──────────────────────
        // "Bloomberg meets FanDuel" — dark, data-rich, tactical
        solidBackground: '#0F1A32',
        surface: '#161B22',
        primaryBlue: '#2489F5',
        emeraldGreen: '#22C55E',
        emeraldGlow: '#10B981',
        chirpRed: '#EF4444',
        chirpAmber: '#F59E0B',
        chirpSoftBlue: '#3B82F6',

        // shadcn/radix compatibility
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-emerald": {
          "0%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)" },
          "70%": { boxShadow: "0 0 0 10px rgba(16, 185, 129, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0)" },
        },
        "slide-alert": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-live": "pulse-emerald 2s infinite",
        "slide-alert": "slide-alert 0.4s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
