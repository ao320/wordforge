import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const base = process.env.NODE_ENV === "production" && repoName ? `/${repoName}/` : "/";
const dataDir = path.resolve(process.cwd(), "public", "data");
const wordFiles = fs.existsSync(dataDir)
  ? fs
      .readdirSync(dataDir)
      .filter((name) => name.toLowerCase().endsWith(".json"))
      .sort()
  : [];

export default defineConfig({
  base,
  plugins: [react()],
  define: {
    __WORD_FILES__: JSON.stringify(wordFiles),
  },
});
