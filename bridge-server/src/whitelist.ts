export const WHITELISTED_COMMANDS = new Set([
  "time",
  "weather",
  "give",
  "tp",
  "gamemode",
  "difficulty",
  "effect",
]);

export const VALID_MATERIALS = new Set([
  "stone",
  "cobblestone",
  "oak_planks",
  "spruce_planks",
  "birch_planks",
  "jungle_planks",
  "acacia_planks",
  "dark_oak_planks",
  "bricks",
  "stone_bricks",
  "sandstone",
  "red_sandstone",
  "quartz_block",
  "prismarine",
  "obsidian",
  "glass",
  "dirt",
  "oak_log",
  "spruce_log",
  "birch_log",
  "iron_block",
  "gold_block",
  "diamond_block",
  "emerald_block",
  "netherrack",
  "deepslate",
  "deepslate_bricks",
  "copper_block",
  "moss_block",
  "packed_ice",
  "snow_block",
  "white_wool",
  "white_concrete",
]);

export function isCommandWhitelisted(command: string): boolean {
  const baseCommand = command.trim().split(/\s+/)[0];
  return WHITELISTED_COMMANDS.has(baseCommand);
}

export function isMaterialValid(material: string): boolean {
  const stripped = material.replace(/^minecraft:/, "");
  return VALID_MATERIALS.has(stripped);
}
