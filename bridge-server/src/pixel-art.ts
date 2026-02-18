import sharp from "sharp";

// 16 Minecraft concrete colors with their RGB values
const MINECRAFT_PALETTE: Record<string, [number, number, number]> = {
  white_concrete: [207, 213, 214],
  orange_concrete: [224, 97, 1],
  magenta_concrete: [169, 48, 159],
  light_blue_concrete: [36, 137, 199],
  yellow_concrete: [241, 175, 21],
  lime_concrete: [94, 169, 25],
  pink_concrete: [214, 101, 143],
  gray_concrete: [55, 58, 62],
  light_gray_concrete: [125, 125, 115],
  cyan_concrete: [21, 119, 136],
  purple_concrete: [100, 32, 156],
  blue_concrete: [45, 47, 143],
  brown_concrete: [96, 60, 32],
  green_concrete: [73, 91, 36],
  red_concrete: [142, 33, 33],
  black_concrete: [8, 10, 15],
};

const paletteEntries = Object.entries(MINECRAFT_PALETTE);

async function fetchImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

async function resizeImage(
  buffer: Buffer,
  maxSize: number
): Promise<{ data: Buffer; width: number; height: number }> {
  const img = sharp(buffer).resize(maxSize, maxSize, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await img
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Re-process with alpha to detect transparency
  const withAlpha = await sharp(buffer)
    .resize(info.width, info.height, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data: withAlpha.data, width: withAlpha.info.width, height: withAlpha.info.height };
}

function closestBlock(r: number, g: number, b: number): string {
  let bestName = "white_concrete";
  let bestDist = Infinity;
  for (const [name, [pr, pg, pb]] of paletteEntries) {
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestName = name;
    }
  }
  return bestName;
}

function quantizeImage(
  pixels: Buffer,
  width: number,
  height: number
): (string | null)[][] {
  const grid: (string | null)[][] = [];
  for (let y = 0; y < height; y++) {
    const row: (string | null)[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4; // RGBA
      const a = pixels[idx + 3];
      if (a < 128) {
        row.push(null); // transparent → skip
      } else {
        row.push(closestBlock(pixels[idx], pixels[idx + 1], pixels[idx + 2]));
      }
    }
    grid.push(row);
  }
  return grid;
}

function generateCommands(
  grid: (string | null)[][],
  originX: number,
  originY: number,
  originZ: number
): string[] {
  const commands: string[] = [];
  const height = grid.length;

  for (let row = 0; row < height; row++) {
    const cols = grid[row];
    const blockY = originY + (height - 1 - row); // row 0 = top = highest Y
    let col = 0;

    while (col < cols.length) {
      const block = cols[col];
      if (block === null) {
        col++;
        continue;
      }

      // Run-length encode: find consecutive same-material pixels
      let runEnd = col + 1;
      while (runEnd < cols.length && cols[runEnd] === block) {
        runEnd++;
      }

      const runLen = runEnd - col;
      const x1 = originX + col;
      const x2 = originX + runEnd - 1;

      if (runLen === 1) {
        commands.push(`setblock ${x1} ${blockY} ${originZ} minecraft:${block}`);
      } else {
        commands.push(
          `fill ${x1} ${blockY} ${originZ} ${x2} ${blockY} ${originZ} minecraft:${block}`
        );
      }

      col = runEnd;
    }
  }

  return commands;
}

export async function processPixelArt(
  url: string,
  playerX: number,
  playerY: number,
  playerZ: number,
  maxCommands = 500
): Promise<{ description: string; commands: string[] }> {
  const imageBuffer = await fetchImage(url);

  let targetSize = 64;
  let commands: string[] = [];
  let finalWidth = 0;
  let finalHeight = 0;

  while (targetSize >= 8) {
    const { data, width, height } = await resizeImage(imageBuffer, targetSize);
    const grid = quantizeImage(data, width, height);

    // Place 2 blocks in front of the player on the Z axis
    commands = generateCommands(grid, playerX, playerY, playerZ + 2);
    finalWidth = width;
    finalHeight = height;

    if (commands.length <= maxCommands) break;

    // Too many commands — scale down
    targetSize = Math.max(8, Math.floor(targetSize * 0.7));
  }

  return {
    description: `Rendering ${finalWidth}x${finalHeight} pixel art (${commands.length} commands)`,
    commands,
  };
}
