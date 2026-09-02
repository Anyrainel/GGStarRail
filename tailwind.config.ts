import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import tailwindcssAnimate from "tailwindcss-animate";

const wideContainerPlugin = plugin(({ addComponents }) => {
  addComponents({
    ".wide-container": {
      width: "100%",
      marginLeft: "auto",
      marginRight: "auto",
      paddingLeft: "0.5rem",
      paddingRight: "0.5rem",
      "@media (min-width: 768px)": {
        paddingLeft: "1rem",
        paddingRight: "1rem",
      },
      "@media (min-width: 1024px)": {
        maxWidth: "980px",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
      },
      "@media (min-width: 1280px)": {
        maxWidth: "1160px",
      },
      "@media (min-width: 1536px)": {
        maxWidth: "1350px",
      },
      "@media (min-width: 2048px)": {
        maxWidth: "1680px",
      },
    },
  });
});

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "0.5rem",
        md: "1.5rem",
        lg: "2rem",
        "2xl": "3rem",
      },
      screens: {
        sm: "100%",
        md: "100%",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
    },
    extend: {
      screens: {
        "3xl": "2048px",
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
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        glow: "0 0 40px hsl(var(--primary) / 0.12)",
      },
      backgroundImage: {
        "gradient-page": "var(--gradient-page)",
        "gradient-card": "var(--gradient-card)",
        "gradient-select": "var(--gradient-select)",
      },
    },
  },
  plugins: [tailwindcssAnimate, wideContainerPlugin],
} satisfies Config;
