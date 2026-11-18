/**
 * Standards-compliant ISO/IEC 18004 QR Code Generator in pure TypeScript.
 * Supports Byte Mode (UTF-8 / URLs up to 270 bytes, Versions 1 to 10, Error Correction Level L),
 * Reed-Solomon GF(256) error correction, all 8 mask patterns with penalty evaluation,
 * SVG Data URL output (for live preview), and direct 2D matrix / Canvas rendering (for PDF export).
 */

interface VersionSpec {
  version: number;
  size: number;
  totalDataCodewords: number;
  ecCodewordsPerBlock: number;
  group1Blocks: number;
  group1DataCodewords: number;
  group2Blocks: number;
  group2DataCodewords: number;
  alignmentCenters: number[];
}

const VERSION_SPECS_EC_L: VersionSpec[] = [
  {
    version: 1,
    size: 21,
    totalDataCodewords: 19,
    ecCodewordsPerBlock: 7,
    group1Blocks: 1,
    group1DataCodewords: 19,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [],
  },
  {
    version: 2,
    size: 25,
    totalDataCodewords: 34,
    ecCodewordsPerBlock: 10,
    group1Blocks: 1,
    group1DataCodewords: 34,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 18],
  },
  {
    version: 3,
    size: 29,
    totalDataCodewords: 55,
    ecCodewordsPerBlock: 15,
    group1Blocks: 1,
    group1DataCodewords: 55,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 22],
  },
  {
    version: 4,
    size: 33,
    totalDataCodewords: 80,
    ecCodewordsPerBlock: 20,
    group1Blocks: 1,
    group1DataCodewords: 80,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 26],
  },
  {
    version: 5,
    size: 37,
    totalDataCodewords: 108,
    ecCodewordsPerBlock: 26,
    group1Blocks: 1,
    group1DataCodewords: 108,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 30],
  },
  {
    version: 6,
    size: 41,
    totalDataCodewords: 136,
    ecCodewordsPerBlock: 18,
    group1Blocks: 2,
    group1DataCodewords: 68,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 34],
  },
  {
    version: 7,
    size: 45,
    totalDataCodewords: 156,
    ecCodewordsPerBlock: 20,
    group1Blocks: 2,
    group1DataCodewords: 78,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 22, 38],
  },
  {
    version: 8,
    size: 49,
    totalDataCodewords: 194,
    ecCodewordsPerBlock: 24,
    group1Blocks: 2,
    group1DataCodewords: 97,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 24, 42],
  },
  {
    version: 9,
    size: 53,
    totalDataCodewords: 232,
    ecCodewordsPerBlock: 30,
    group1Blocks: 2,
    group1DataCodewords: 116,
    group2Blocks: 0,
    group2DataCodewords: 0,
    alignmentCenters: [6, 26, 46],
  },
  {
    version: 10,
    size: 57,
    totalDataCodewords: 274,
    ecCodewordsPerBlock: 18,
    group1Blocks: 2,
    group1DataCodewords: 68,
    group2Blocks: 2,
    group2DataCodewords: 69,
    alignmentCenters: [6, 28, 50],
  },
];

// GF(256) log and exp tables with primitive polynomial 0x11D (285)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildReedSolomonGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomonEcBytes(
  data: Uint8Array,
  ecLength: number
): Uint8Array {
  const gen = buildReedSolomonGeneratorPoly(ecLength);
  const remainder = new Uint8Array(ecLength);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecLength - 1; j++) {
      remainder[j] = remainder[j + 1];
    }
    remainder[ecLength - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLength; j++) {
        remainder[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return remainder;
}

function selectVersionForBytePayload(byteLength: number): VersionSpec {
  for (const spec of VERSION_SPECS_EC_L) {
    const countIndicatorBits = spec.version <= 9 ? 8 : 16;
    const availableBits = spec.totalDataCodewords * 8 - 4 - countIndicatorBits;
    const maxBytes = Math.floor(availableBits / 8);
    if (byteLength <= maxBytes) {
      return spec;
    }
  }
  // If payload exceeds Version 10 capacity (271 bytes), truncate safely
  return VERSION_SPECS_EC_L[VERSION_SPECS_EC_L.length - 1];
}

function encodeDataCodewords(payloadBytes: Uint8Array, spec: VersionSpec): Uint8Array {
  const countBits = spec.version <= 9 ? 8 : 16;
  const maxBytes = Math.floor((spec.totalDataCodewords * 8 - 4 - countBits) / 8);
  const safeBytes =
    payloadBytes.length > maxBytes
      ? payloadBytes.slice(0, maxBytes)
      : payloadBytes;

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  };

  // Byte Mode indicator (0100)
  pushBits(0b0100, 4);
  // Character count indicator
  pushBits(safeBytes.length, countBits);
  // Payload bytes
  for (let i = 0; i < safeBytes.length; i++) {
    pushBits(safeBytes[i], 8);
  }

  // Terminator (up to 4 zero bits)
  const totalCapacityBits = spec.totalDataCodewords * 8;
  const terminatorLen = Math.min(4, totalCapacityBits - bits.length);
  pushBits(0, terminatorLen);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(spec.totalDataCodewords);
  const filledBytes = bits.length / 8;
  for (let i = 0; i < filledBytes; i++) {
    let b = 0;
    for (let bit = 0; bit < 8; bit++) {
      b = (b << 1) | bits[i * 8 + bit];
    }
    codewords[i] = b;
  }

  // Pad remaining codewords alternating 0xEC and 0x11
  const padBytes = [0xec, 0x11];
  for (let i = filledBytes; i < spec.totalDataCodewords; i++) {
    codewords[i] = padBytes[(i - filledBytes) % 2];
  }

  return codewords;
}

function interleaveWithErrorCorrection(
  dataCodewords: Uint8Array,
  spec: VersionSpec
): Uint8Array {
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < spec.group1Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + spec.group1DataCodewords);
    offset += spec.group1DataCodewords;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonEcBytes(block, spec.ecCodewordsPerBlock));
  }

  for (let i = 0; i < spec.group2Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + spec.group2DataCodewords);
    offset += spec.group2DataCodewords;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomonEcBytes(block, spec.ecCodewordsPerBlock));
  }

  const maxDataLen = Math.max(
    spec.group1DataCodewords,
    spec.group2DataCodewords
  );
  const result: number[] = [];

  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) {
        result.push(block[i]);
      }
    }
  }

  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) {
        result.push(block[i]);
      }
    }
  }

  return new Uint8Array(result);
}

// Format info 15-bit sequences for EC Level L (01) and masks 0..7
const FORMAT_INFO_BITS_L = [
  0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
];

function evaluateMaskFunction(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function writeFormatInfo(
  modules: boolean[][],
  isFunction: boolean[][],
  size: number,
  mask: number
): void {
  const bits = FORMAT_INFO_BITS_L[mask] ?? FORMAT_INFO_BITS_L[0];

  const getBit = (idx: number): boolean => ((bits >>> idx) & 1) === 1;

  // Top-left copy (bit 14 is MSB at (8,0), bit 0 is LSB at (0,8))
  const tlCoords: [number, number][] = [
    [0, 8], // bit 0
    [1, 8], // bit 1
    [2, 8], // bit 2
    [3, 8], // bit 3
    [4, 8], // bit 4
    [5, 8], // bit 5
    [7, 8], // bit 6
    [8, 8], // bit 7
    [8, 7], // bit 8
    [8, 5], // bit 9
    [8, 4], // bit 10
    [8, 3], // bit 11
    [8, 2], // bit 12
    [8, 1], // bit 13
    [8, 0], // bit 14
  ];

  for (let i = 0; i < 15; i++) {
    const [r, c] = tlCoords[i];
    modules[r][c] = getBit(i);
    isFunction[r][c] = true;
  }

  // Top-right (bits 0..7) and Bottom-left (bits 8..14)
  for (let i = 0; i <= 7; i++) {
    const r = 8;
    const c = size - 1 - i;
    modules[r][c] = getBit(i);
    isFunction[r][c] = true;
  }
  for (let i = 8; i < 15; i++) {
    const r = size - 15 + i;
    const c = 8;
    modules[r][c] = getBit(i);
    isFunction[r][c] = true;
  }

  // Fixed dark module
  modules[size - 8][8] = true;
  isFunction[size - 8][8] = true;
}

function computePenaltyScore(modules: boolean[][]): number {
  const size = modules.length;
  let penalty = 0;

  // Rule 1: 5+ consecutive modules of same color in row or col
  for (let r = 0; r < size; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  for (let c = 0; c < size; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const color = modules[r][c];
      if (
        modules[r][c + 1] === color &&
        modules[r + 1][c] === color &&
        modules[r + 1][c + 1] === color
      ) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

/**
 * Generates a 2D boolean matrix (including a quiet zone of `quietZone` modules)
 * representing a valid, camera-scannable QR code for `text`.
 */
export function generateQrMatrix(text: string, quietZone = 4): boolean[][] {
  const cleanText = (text || '').trim() || 'https://moe.gov.sa';
  const payloadBytes = new TextEncoder().encode(cleanText);
  const spec = selectVersionForBytePayload(payloadBytes.length);
  const size = spec.size;

  const baseModules: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const setFunctionModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      baseModules[r][c] = dark;
      isFunction[r][c] = true;
    }
  };

  // 1. Finder patterns (7x7) + 1-module white separator
  const drawFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = topR + dr;
        const c = leftC + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onOuterBorder =
          dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inInner3x3 = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        const dark = inOuter && (onOuterBorder || inInner3x3);
        setFunctionModule(r, c, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment patterns (5x5)
  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      // Skip corners occupied by finder patterns
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      const cr = centers[i];
      const cc = centers[j];
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunctionModule(cr + dr, cc + dc, dist !== 1);
        }
      }
    }
  }

  // 3. Timing patterns (row 6 and col 6)
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      setFunctionModule(6, i, i % 2 === 0);
    }
    if (!isFunction[i][6]) {
      setFunctionModule(i, 6, i % 2 === 0);
    }
  }

  // 4. Reserve format information modules
  writeFormatInfo(baseModules, isFunction, size, 0);

  // 5. Encode and interleave codewords
  const dataCw = encodeDataCodewords(payloadBytes, spec);
  const allCodewords = interleaveWithErrorCorrection(dataCw, spec);

  // 6. Place codeword bits in upward/downward 2-column zigzag
  let bitIdx = 0;
  const totalBits = allCodewords.length * 8;
  let upward = true;

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) {
      rightCol = 5; // Skip vertical timing pattern column
    }
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            const byteVal = allCodewords[bitIdx >>> 3];
            dark = ((byteVal >>> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          baseModules[r][c] = dark;
        }
      }
    }
    upward = !upward;
  }

  // 7. Evaluate all 8 masks and choose the lowest-penalty mask
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestModules = baseModules;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseModules.map((row, r) =>
      row.map((val, c) =>
        isFunction[r][c]
          ? val
          : val !== evaluateMaskFunction(mask, r, c)
      )
    );
    writeFormatInfo(candidate, isFunction, size, mask);
    const penalty = computePenaltyScore(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  // Ensure format info is written for bestMask
  writeFormatInfo(bestModules, isFunction, size, bestMask);

  // 8. Add quiet zone
  const q = Math.max(0, quietZone);
  const fullSize = size + q * 2;
  const withQuietZone: boolean[][] = Array.from({ length: fullSize }, () =>
    Array(fullSize).fill(false)
  );

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      withQuietZone[r + q][c + q] = bestModules[r][c];
    }
  }

  return withQuietZone;
}

/**
 * Generates an inline SVG Data URL (`data:image/svg+xml;utf8,...`) for a QR code.
 * Works identically in browser `<img>` tags and in Node.js unit tests.
 */
export function generateQrSvgDataUrl(
  text: string,
  darkHex = '#15445A',
  lightHex = '#FFFFFF',
  quietZone = 3
): string {
  const matrix = generateQrMatrix(text, quietZone);
  const n = matrix.length;
  let paths = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        paths += `M${c},${r}h1v1h-1z`;
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${lightHex}"/><path d="${paths}" fill="${darkHex}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Draws a crisp, high-resolution QR code directly onto a 2D Canvas context at `(x, y, sizePx, sizePx)`
 * with integer-snapped module edges so it never looks blurry when zoomed or printed.
 */
export function drawQrCodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  sizePx: number,
  darkHex = '#153C43',
  lightHex = '#FFFFFF',
  quietZone = 4
): { matrixSize: number; quietZone: number } {
  const matrix = generateQrMatrix(text, quietZone);
  const n = matrix.length;
  const moduleSize = sizePx / n;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = lightHex;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(sizePx), Math.ceil(sizePx));

  ctx.fillStyle = darkHex;
  for (let r = 0; r < n; r++) {
    const ry0 = Math.round(y + r * moduleSize);
    const ry1 = Math.round(y + (r + 1) * moduleSize);
    const rh = Math.max(1, ry1 - ry0);
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const rx0 = Math.round(x + c * moduleSize);
        const rx1 = Math.round(x + (c + 1) * moduleSize);
        const rw = Math.max(1, rx1 - rx0);
        ctx.fillRect(rx0, ry0, rw, rh);
      }
    }
  }
  ctx.restore();
  return { matrixSize: n, quietZone };
}

/**
 * Samples the actual rendered pixels from a 2D Canvas region `(x, y, sizePx, sizePx)`
 * and decodes the QR code matrix using ISO/IEC 18004 decoding to verify real camera scannability.
 */
export function decodeQrCodeFromCanvasRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  sizePx: number,
  matrixSize: number,
  quietZone = 4
): string {
  const imgData = ctx.getImageData(
    Math.round(x),
    Math.round(y),
    Math.round(sizePx),
    Math.round(sizePx)
  );
  const { data, width, height } = imgData;
  const moduleSize = sizePx / matrixSize;

  const sampledMatrix: boolean[][] = Array.from({ length: matrixSize }, (_, r) =>
    Array.from({ length: matrixSize }, (__, c) => {
      const px = Math.min(
        width - 1,
        Math.max(0, Math.floor((c + 0.5) * moduleSize))
      );
      const py = Math.min(
        height - 1,
        Math.max(0, Math.floor((r + 0.5) * moduleSize))
      );
      const idx = (py * width + px) * 4;
      const red = data[idx] ?? 255;
      const green = data[idx + 1] ?? 255;
      const blue = data[idx + 2] ?? 255;
      const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
      return luminance < 140;
    })
  );

  return decodeQrMatrix(sampledMatrix, quietZone);
}

/**
 * Decodes a 2D boolean QR matrix (with `quietZone` modules around it) back into its UTF-8 string payload
 * following ISO/IEC 18004 format info, unmasking, zigzag codeword extraction, and Byte Mode decoding.
 * Used to verify that generated QR codes are 100% camera-scannable.
 */
export function decodeQrMatrix(
  matrixWithQuietZone: boolean[][],
  quietZone = 0
): string {
  const fullSize = matrixWithQuietZone.length;
  const size = fullSize - quietZone * 2;
  const spec = VERSION_SPECS_EC_L.find((s) => s.size === size);
  if (!spec) {
    throw new Error(`Unsupported QR matrix size: ${size}`);
  }

  const modules: boolean[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (__, c) =>
      Boolean(matrixWithQuietZone[r + quietZone]?.[c + quietZone])
    )
  );

  // Read top-left 15-bit format info
  const tlCoords: [number, number][] = [
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [7, 8],
    [8, 8],
    [8, 7],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [8, 0],
  ];

  let formatBits = 0;
  for (let i = 14; i >= 0; i--) {
    const [r, c] = tlCoords[i];
    formatBits = (formatBits << 1) | (modules[r][c] ? 1 : 0);
  }

  let mask = FORMAT_INFO_BITS_L.indexOf(formatBits);
  if (mask === -1) {
    let bestDist = Infinity;
    mask = 0;
    for (let m = 0; m < FORMAT_INFO_BITS_L.length; m++) {
      let xor = formatBits ^ FORMAT_INFO_BITS_L[m];
      let dist = 0;
      while (xor > 0) {
        dist += xor & 1;
        xor >>>= 1;
      }
      if (dist < bestDist) {
        bestDist = dist;
        mask = m;
      }
    }
  }

  // Mark function modules
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const markFunc = (r: number, c: number) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      isFunction[r][c] = true;
    }
  };

  const markFinder = (topR: number, leftC: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        markFunc(topR + dr, leftC + dc);
      }
    }
  };
  markFinder(0, 0);
  markFinder(0, size - 7);
  markFinder(size - 7, 0);

  const centers = spec.alignmentCenters;
  for (let i = 0; i < centers.length; i++) {
    for (let j = 0; j < centers.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === centers.length - 1) ||
        (i === centers.length - 1 && j === 0)
      ) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          markFunc(centers[i] + dr, centers[j] + dc);
        }
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    markFunc(6, i);
    markFunc(i, 6);
  }

  for (const [r, c] of tlCoords) markFunc(r, c);
  for (let i = 0; i <= 7; i++) markFunc(8, size - 1 - i);
  for (let i = 8; i < 15; i++) markFunc(size - 15 + i, 8);
  markFunc(size - 8, 8);

  // Unmask data modules and extract bits in 2-column zigzag
  const extractedBits: number[] = [];
  let upward = true;
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc;
        if (!isFunction[r][c]) {
          const unmasked =
            modules[r][c] !== evaluateMaskFunction(mask, r, c);
          extractedBits.push(unmasked ? 1 : 0);
        }
      }
    }
    upward = !upward;
  }

  const totalCodewords =
    spec.totalDataCodewords +
    (spec.group1Blocks + spec.group2Blocks) * spec.ecCodewordsPerBlock;
  const interleaved = new Uint8Array(totalCodewords);
  for (let i = 0; i < totalCodewords; i++) {
    let b = 0;
    for (let bit = 0; bit < 8; bit++) {
      b = (b << 1) | (extractedBits[i * 8 + bit] ?? 0);
    }
    interleaved[i] = b;
  }

  // De-interleave data codewords
  const totalBlocks = spec.group1Blocks + spec.group2Blocks;
  const blocks: number[][] = Array.from({ length: totalBlocks }, () => []);
  const maxDataLen = Math.max(
    spec.group1DataCodewords,
    spec.group2DataCodewords
  );
  let pos = 0;
  for (let i = 0; i < maxDataLen; i++) {
    for (let bIdx = 0; bIdx < totalBlocks; bIdx++) {
      const blockCap =
        bIdx < spec.group1Blocks
          ? spec.group1DataCodewords
          : spec.group2DataCodewords;
      if (i < blockCap) {
        blocks[bIdx].push(interleaved[pos++]);
      }
    }
  }

  const dataBytesFlat: number[] = [];
  for (const blk of blocks) {
    dataBytesFlat.push(...blk);
  }

  const dataBits: number[] = [];
  for (const b of dataBytesFlat) {
    for (let bit = 7; bit >= 0; bit--) {
      dataBits.push((b >>> bit) & 1);
    }
  }

  const readBits = (start: number, len: number): number => {
    let val = 0;
    for (let i = 0; i < len; i++) {
      val = (val << 1) | (dataBits[start + i] ?? 0);
    }
    return val;
  };

  const mode = readBits(0, 4);
  if (mode !== 0b0100) {
    throw new Error(`Expected Byte mode (0100), got ${mode}`);
  }
  const countBits = spec.version <= 9 ? 8 : 16;
  const byteCount = readBits(4, countBits);
  const payload = new Uint8Array(byteCount);
  let bitCursor = 4 + countBits;
  for (let i = 0; i < byteCount; i++) {
    payload[i] = readBits(bitCursor, 8);
    bitCursor += 8;
  }

  return new TextDecoder().decode(payload);
}
