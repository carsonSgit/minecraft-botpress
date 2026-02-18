export const WHITELISTED_COMMANDS = new Set([
  // Vanilla commands
  "time",
  "weather",
  "give",
  "tp",
  "gamemode",
  "difficulty",
  "effect",
  "kill",
  "clear",
  "summon",
  "setblock",
  "fill",
  "clone",
  "enchant",
  "xp",
  "spawnpoint",
  "setworldspawn",
  "playsound",
  "title",
  "tellraw",
  "particle",
  "locate",
  // WorldEdit commands (stored with // prefix)
  "//set",
  "//replace",
  "//walls",
  "//outline",
  "//hollow",
  "//copy",
  "//paste",
  "//cut",
  "//rotate",
  "//flip",
  "//stack",
  "//move",
  "//undo",
  "//redo",
  "//pos1",
  "//pos2",
  "//hpos1",
  "//hpos2",
  "//expand",
  "//contract",
  "//shift",
  "//cyl",
  "//hcyl",
  "//sphere",
  "//hsphere",
  "//pyramid",
  "//hpyramid",
  "//wand",
  "//sel",
  "//line",
  "//curve",
  "//drain",
  "//regen",
]);

const CONCRETE_COLORS = [
  "white",
  "orange",
  "magenta",
  "light_blue",
  "yellow",
  "lime",
  "pink",
  "gray",
  "light_gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
];

const WOOL_COLORS = CONCRETE_COLORS;

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
  // All colored concrete
  ...CONCRETE_COLORS.map((c) => `${c}_concrete`),
  // All colored wool
  ...WOOL_COLORS.map((c) => `${c}_wool`),
]);

export function isCommandWhitelisted(command: string): boolean {
  const trimmed = command.trim();

  // Handle WorldEdit commands starting with //
  if (trimmed.startsWith("//")) {
    const baseCommand = `//${trimmed.substring(2).split(/\s+/)[0]}`;
    return WHITELISTED_COMMANDS.has(baseCommand);
  }

  const baseCommand = trimmed.split(/\s+/)[0];
  return WHITELISTED_COMMANDS.has(baseCommand);
}

export function isMaterialValid(material: string): boolean {
  const stripped = material.replace(/^minecraft:/, "");
  return VALID_MATERIALS.has(stripped);
}
