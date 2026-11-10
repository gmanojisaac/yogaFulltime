import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "temporal",
              test: /node_modules[\\/](@js-temporal|jsbi)[\\/]/,
              priority: 2,
            },
            { name: "vendor", test: /node_modules/, priority: 1 },
            {
              debugName: "curriculum",
              name: (id) =>
                `curriculum-${id.split(/[\\/]/).at(-1)?.replace(".json", "")}`,
              test: /[\\/]data[\\/].*\.json$/,
            },
          ],
        },
      },
    },
  },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
