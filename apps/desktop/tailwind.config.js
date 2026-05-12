/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        label: ['"Antonio"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        lcd: ['"VT323"', "ui-monospace", "monospace"],
      },
      colors: {
        /* shadcn token bridge */
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
        /* Cassette deck named tokens (used by ui.tsx primitives directly) */
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
      },
      animation: {
        "pulse-led": "pulse-led 1.4s ease-in-out infinite",
        "reel-spin": "reel-spin 3.2s linear infinite",
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@tailwindcss/container-queries"),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate"),
  ],
};
