import { defineConfig, z } from "@botpress/runtime";

export default defineConfig({
  name: "minebot-agent",
  description:
    "MineBot AI - A Minecraft assistant that classifies player intent into chat responses, game commands, or building instructions. Returns structured JSON for the bridge server.",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  dependencies: {
    integrations: {
      chat: { version: "chat@0.7.5", enabled: true },
    },
  },
});
