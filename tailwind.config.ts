import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bark: "#3f2e1f",
        moss: "#587341",
        amberleaf: "#f1c86b",
        cream: "#f8f1e2",
        berry: "#b94f46",
        pond: "#6eaec7"
      },
      fontFamily: {
        sans: ["Trebuchet MS", "Verdana", "sans-serif"],
        display: ["Georgia", "Trebuchet MS", "serif"]
      },
      boxShadow: {
        story: "0 16px 40px rgba(66, 44, 21, 0.18)"
      },
      backgroundImage: {
        paper: "radial-gradient(circle at top, rgba(255,255,255,0.45), transparent 45%), linear-gradient(180deg, #f6edd7 0%, #f2e4bf 100%)"
      }
    }
  },
  plugins: []
};

export default config;
