import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        "**/reference-ui/**",
        "**/dev-*.log",
      ],
    };
    return config;
  },
};

export default nextConfig;
