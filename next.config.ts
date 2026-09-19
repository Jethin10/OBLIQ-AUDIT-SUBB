import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production artifacts away from the development cache. Running
  // `next build` while `next dev` is active can otherwise leave the dev
  // server requiring chunks that the build just replaced.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  webpack(config) {
    // Reference exports and browser-test artifacts live beside the app, but
    // they are inputs/outputs rather than application source. Ignoring them
    // prevents their logs and screenshots from triggering a dev-server
    // recompilation loop during visual QA.
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        ...(Array.isArray(config.watchOptions?.ignored)
          ? config.watchOptions.ignored
          : []),
        "**/.playwright-cli/**",
        "**/.next-build/**",
        "**/.next-test/**",
        "**/reference-ui/**",
        "**/dev-*.log",
      ],
    };
    return config;
  },
};

export default nextConfig;
