import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root so Turbopack doesn't infer it from an unrelated
  // parent-directory lockfile when multiple are present.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
