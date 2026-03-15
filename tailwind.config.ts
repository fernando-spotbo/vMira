import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "gpt-gray": {
          50: "#f7f7f8",
          100: "#ececec",
          200: "#e3e3e3",
          300: "#cdcdcd",
          400: "#999696",
          500: "#595959",
          600: "#424242",
          700: "#2f2f2f",
          800: "#212121",
          850: "#171717",
          900: "#0d0d0d",
        },
        "gpt-green": "#10a37f",
      },
    },
  },
  plugins: [],
};
export default config;
