/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#3b82f6",
        secondary: "#1e293b",
        accent: "#06b6d4",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
