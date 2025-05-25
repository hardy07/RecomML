import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/login": "http://localhost:3000",
      "/callback": "http://localhost:3000",
      "/train-model": "http://localhost:3000",
      "/create-playlist": "http://localhost:3000",
      "/check-auth": "http://localhost:3000",
    },
  },
  define: {
    "process.env.VITE_SPOTIFY_CLIENT_ID": JSON.stringify(
      process.env.VITE_SPOTIFY_CLIENT_ID
    ),
  },
});
