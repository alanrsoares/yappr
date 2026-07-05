/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        label: ['"Antonio"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        lcd: ['"VT323"', "ui-monospace", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chassis: "#0a0907",
        "chassis-deep": "#050402",
        panel: "#171411",
        "panel-edge": "#221d18",
        foil: "#c9c2b3",
        "foil-mute": "#6b6358",
        "foil-dim": "#46413a",
        "led-amber": "#ffa500",
        "led-amber-soft": "#7a4f00",
        "led-red": "#ff3838",
        "led-red-soft": "#5a1010",
        "led-green": "#3ee27c",
        "led-green-soft": "#0b3d1d",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) + 1px)",
        sm: "calc(var(--radius) - 1px)",
      },
      boxShadow: {
        chassis:
          "0 30px 60px -20px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
        bezel:
          "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.4)",
        "bezel-deep":
          "inset 0 2px 6px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(0,0,0,0.6)",
        button:
          "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.5)",
        "button-pressed":
          "inset 0 2px 4px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.05)",
        "led-amber":
          "0 0 6px rgba(255,165,0,0.7), 0 0 14px rgba(255,165,0,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
        "led-red":
          "0 0 6px rgba(255,56,56,0.7), 0 0 14px rgba(255,56,56,0.35), inset 0 1px 0 rgba(255,255,255,0.4)",
        "led-green":
          "0 0 6px rgba(62,226,124,0.7), 0 0 14px rgba(62,226,124,0.3), inset 0 1px 0 rgba(255,255,255,0.4)",
        "led-off": "inset 0 1px 1px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "chassis-grain":
          "linear-gradient(180deg, #0c0b09 0%, #0a0907 50%, #08070506 100%)",
        panel: "linear-gradient(180deg, #1c1815 0%, #161310 100%)",
        "panel-strip":
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.3) 100%)",
        "button-raised":
          "linear-gradient(180deg, #2a241e 0%, #1c1814 50%, #15110d 100%)",
        lcd: "linear-gradient(180deg, #1a0e02 0%, #0d0701 100%)",
      },
      keyframes: {
        "pulse-led": {
          "0%, 100%": { opacity: "0.85", filter: "brightness(1)" },
          "50%": { opacity: "1", filter: "brightness(1.35)" },
        },
        "reel-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        typing: {
          "0%, 100%": { transform: "translateY(0)", opacity: "0.5" },
          "50%": { transform: "translateY(-2px)", opacity: "1" },
        },
        "loading-dots": {
          "0%, 100%": { opacity: "0" },
          "50%": { opacity: "1" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(1)" },
          "50%": { transform: "scaleY(0.6)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "text-blink": {
          "0%, 100%": { color: "var(--primary)" },
          "50%": { color: "var(--muted-foreground)" },
        },
        "bounce-dots": {
          "0%, 100%": { transform: "scale(0.8)", opacity: "0.5" },
          "50%": { transform: "scale(1.2)", opacity: "1" },
        },
        "thin-pulse": {
          "0%, 100%": { transform: "scale(0.95)", opacity: "0.8" },
          "50%": { transform: "scale(1.05)", opacity: "0.4" },
        },
        "pulse-dot": {
          "0%, 100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.5)", opacity: "1" },
        },
        "shimmer-text": {
          "0%": { backgroundPosition: "150% center" },
          "100%": { backgroundPosition: "-150% center" },
        },
        "wave-bars": {
          "0%, 100%": { transform: "scaleY(1)", opacity: "0.5" },
          "50%": { transform: "scaleY(0.6)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 50%" },
          "100%": { backgroundPosition: "-200% 50%" },
        },
        "spinner-fade": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-led": "pulse-led 1.4s ease-in-out infinite",
        "reel-spin": "reel-spin 3.2s linear infinite",
      },
    },
  },
};
