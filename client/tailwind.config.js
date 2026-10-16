/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rollz: {
          bg: "#F5F7FB",
          sidebar: "#FFFFFF",
          card: "#FFFFFF",
          input: "#F8FAFC",
          blue: "#2563EB",
          "blue-hover": "#1D4ED8",
          cyan: "#06B6D4",
          red: "#EF3038",
          "red-hover": "#DC2626",
          text: "#172033",
          secondary: "#64748B",
          border: "#E2E8F0",
          muted: "#F1F5F9",
          success: "#16A34A",
          warning: "#D97706",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 10px -2px rgba(23, 32, 51, 0.05), 0 1px 3px -1px rgba(23, 32, 51, 0.05)",
        card: "0 4px 20px -2px rgba(23, 32, 51, 0.06), 0 2px 6px -1px rgba(23, 32, 51, 0.04)",
      },
    },
  },
  plugins: [],
}

