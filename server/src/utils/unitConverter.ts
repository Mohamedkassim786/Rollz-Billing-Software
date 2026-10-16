/**
 * Unit conversion and compatibility utilities for ROLLZ POS Inventory.
 * Supports weight (g, kg, mg), volume (ml, L), and discrete units (piece, packet, etc.).
 * Strictly prevents invalid conversions between unrelated unit classes (e.g. piece to grams).
 */

export type UnitType = "WEIGHT" | "VOLUME" | "DISCRETE";

interface UnitDefinition {
  type: UnitType;
  baseMultiplier: number; // Multiplier to base unit (grams for WEIGHT, ml for VOLUME, 1 for DISCRETE)
}

const UNIT_MAP: Record<string, UnitDefinition> = {
  // Weight units (base: grams)
  g: { type: "WEIGHT", baseMultiplier: 1 },
  gm: { type: "WEIGHT", baseMultiplier: 1 },
  gram: { type: "WEIGHT", baseMultiplier: 1 },
  grams: { type: "WEIGHT", baseMultiplier: 1 },
  kg: { type: "WEIGHT", baseMultiplier: 1000 },
  kilogram: { type: "WEIGHT", baseMultiplier: 1000 },
  kilograms: { type: "WEIGHT", baseMultiplier: 1000 },
  mg: { type: "WEIGHT", baseMultiplier: 0.001 },
  milligram: { type: "WEIGHT", baseMultiplier: 0.001 },

  // Volume units (base: ml)
  ml: { type: "VOLUME", baseMultiplier: 1 },
  milliliter: { type: "VOLUME", baseMultiplier: 1 },
  l: { type: "VOLUME", baseMultiplier: 1000 },
  liter: { type: "VOLUME", baseMultiplier: 1000 },
  litre: { type: "VOLUME", baseMultiplier: 1000 },
  liters: { type: "VOLUME", baseMultiplier: 1000 },
  litres: { type: "VOLUME", baseMultiplier: 1000 },

  // Discrete units (base: 1 piece/unit)
  piece: { type: "DISCRETE", baseMultiplier: 1 },
  pieces: { type: "DISCRETE", baseMultiplier: 1 },
  pc: { type: "DISCRETE", baseMultiplier: 1 },
  pcs: { type: "DISCRETE", baseMultiplier: 1 },
  packet: { type: "DISCRETE", baseMultiplier: 1 },
  packets: { type: "DISCRETE", baseMultiplier: 1 },
  pkt: { type: "DISCRETE", baseMultiplier: 1 },
  bottle: { type: "DISCRETE", baseMultiplier: 1 },
  bottles: { type: "DISCRETE", baseMultiplier: 1 },
  box: { type: "DISCRETE", baseMultiplier: 1 },
  boxes: { type: "DISCRETE", baseMultiplier: 1 },
  can: { type: "DISCRETE", baseMultiplier: 1 },
  cans: { type: "DISCRETE", baseMultiplier: 1 },
  portion: { type: "DISCRETE", baseMultiplier: 1 },
  portions: { type: "DISCRETE", baseMultiplier: 1 },
  bun: { type: "DISCRETE", baseMultiplier: 1 },
  buns: { type: "DISCRETE", baseMultiplier: 1 },
  egg: { type: "DISCRETE", baseMultiplier: 1 },
  eggs: { type: "DISCRETE", baseMultiplier: 1 },
};

/**
 * Standardize unit string to canonical short code
 */
export function normalizeUnit(rawUnit: string): string {
  const cleaned = (rawUnit || "").trim().toLowerCase();
  switch (cleaned) {
    case "g":
    case "gm":
    case "gram":
    case "grams":
      return "g";
    case "kg":
    case "kilogram":
    case "kilograms":
      return "kg";
    case "mg":
    case "milligram":
      return "mg";
    case "ml":
    case "milliliter":
      return "ml";
    case "l":
    case "litre":
    case "liter":
    case "litres":
    case "liters":
      return "L";
    case "pc":
    case "pcs":
    case "piece":
    case "pieces":
      return "piece";
    case "pkt":
    case "packet":
    case "packets":
      return "packet";
    case "bottle":
    case "bottles":
      return "bottle";
    case "box":
    case "boxes":
      return "box";
    case "can":
    case "cans":
      return "can";
    default:
      return cleaned;
  }
}

/**
 * Check if two unit strings can be converted safely
 */
export function areUnitsCompatible(unitA: string, unitB: string): boolean {
  const normA = normalizeUnit(unitA);
  const normB = normalizeUnit(unitB);

  if (normA === normB) return true;

  const defA = UNIT_MAP[normA.toLowerCase()];
  const defB = UNIT_MAP[normB.toLowerCase()];

  if (!defA || !defB) {
    return normA === normB;
  }

  // Discrete units must match exactly
  if (defA.type === "DISCRETE" || defB.type === "DISCRETE") {
    return normA === normB;
  }

  // Weight and Volume can only convert within their own class
  return defA.type === defB.type;
}

/**
 * Convert quantity from one unit to another.
 * Throws an error if units are incompatible.
 *
 * Example:
 * convertQuantity(200, "g", "kg") => 0.2
 * convertQuantity(1.5, "kg", "g") => 1500
 * convertQuantity(500, "ml", "L") => 0.5
 * convertQuantity(2, "piece", "piece") => 2
 */
export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number {
  if (quantity === 0) return 0;

  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === normTo) {
    return quantity;
  }

  const defFrom = UNIT_MAP[normFrom.toLowerCase()];
  const defTo = UNIT_MAP[normTo.toLowerCase()];

  if (!defFrom || !defTo || defFrom.type !== defTo.type) {
    throw new Error(
      `Cannot convert incompatible units: "${fromUnit}" to "${toUnit}". Unrelated units (e.g. piece vs weight or weight vs volume) cannot be converted automatically.`
    );
  }

  if (defFrom.type === "DISCRETE") {
    if (normFrom !== normTo) {
      throw new Error(`Cannot convert between different discrete units: "${fromUnit}" to "${toUnit}"`);
    }
    return quantity;
  }

  // Base quantity in grams or ml
  const baseValue = quantity * defFrom.baseMultiplier;
  // Convert to target unit
  const targetValue = baseValue / defTo.baseMultiplier;

  // Round to 4 decimal places to prevent floating point inaccuracies like 0.20000000000000004
  return Math.round(targetValue * 10000) / 10000;
}
