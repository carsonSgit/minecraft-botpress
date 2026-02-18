import { DataSource, Knowledge } from "@botpress/runtime";

const minecraftDocs = DataSource.Directory.fromPath("src/knowledge/minecraft");

export default new Knowledge({
  name: "minecraft",
  description:
    "Minecraft game knowledge including crafting recipes, mob information, building tips, and decorative blocks",
  sources: [minecraftDocs],
});
