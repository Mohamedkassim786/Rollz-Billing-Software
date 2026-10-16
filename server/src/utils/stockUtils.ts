/**
 * Stock calculation and status evaluation utilities for ROLLZ POS Inventory.
 */

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

/**
 * Calculate stock status based on current stock and threshold:
 * - OUT OF STOCK: currentStock <= 0
 * - LOW STOCK: currentStock <= minThreshold and currentStock > 0
 * - IN STOCK: currentStock > minThreshold
 */
export function calculateStockStatus(currentStock: number, minThreshold: number): StockStatus {
  if (currentStock <= 0) {
    return "OUT_OF_STOCK";
  }
  if (currentStock <= minThreshold) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}
