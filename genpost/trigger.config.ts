import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_zuulfbliiozvxuwvymkl",
  runtime: "node",
  logLevel: "log",
  // Specify where the task files are located
  dirs: ["trigger"],
  maxDuration: 300, // Maximum execution time in seconds (5 minutes)
});
