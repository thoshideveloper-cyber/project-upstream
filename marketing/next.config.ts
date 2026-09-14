import type { NextConfig } from "next";

/**
 * GitHub Pages build (`PAGES_EXPORT=1 npm run build`).
 *
 * Pages serves a project repo from a sub-path, so the export needs a basePath and
 * a matching asset prefix, and `trailingSlash` so `/coming-soon` resolves to a
 * directory index rather than 404ing. `PAGES_BASE_PATH` lets a different repo name
 * override it. None of this applies to a normal server build — the default export
 * is unchanged, so deploying to a Node host still works exactly as before.
 */
const pagesExport = process.env.PAGES_EXPORT === "1";
const basePath = process.env.PAGES_BASE_PATH ?? "/version_zero";
/**
 * Absolute origin for the share card. Metadata image URLs are not rewritten by
 * `basePath` and are not relative-resolved by the crawlers that read them, so
 * without this Next falls back to `http://localhost:3000` and every shared link
 * shows no preview. `PAGES_SITE_URL` overrides it for a different host.
 */
const siteUrl = process.env.PAGES_SITE_URL ?? "https://project-upstream.github.io";

const nextConfig: NextConfig = {
  // A handful of static product PNGs — skip the optimizer (and the sharp dep).
  images: { unoptimized: true },
  ...(pagesExport
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath,
        trailingSlash: true,
        // Injected here rather than exported from the shell: MSYS/Git Bash
        // rewrites a leading-slash env value into a Windows path, which silently
        // produced `src="C:/Program Files/Git/version_zero/..."` on the images.
        env: { NEXT_PUBLIC_BASE_PATH: basePath, NEXT_PUBLIC_SITE_URL: siteUrl },
      }
    : {}),
};

export default nextConfig;
