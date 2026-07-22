import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EDEBE6",
        ink: "#1C1B18",
        signal: "#E0301E",
        pine: "#2E4B3F",
        fog: "#8C8A83"
      },
      fontFamily: {
        display: ["'Archivo'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"]
      }
    }
  },
  plugins: []
};
export default config;
