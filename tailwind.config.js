/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: { soft: "0 8px 24px rgba(0,0,0,0.06)" },
      colors: { brand: "#0F172A", accent: "#16A34A" }
    }
  },
  plugins: []
}
