export interface DelayCalculation {
  /** Total delay in milliseconds */
  delayMs: number;
  /** Total delay in seconds (for display) */
  delaySec: number;
  /** Base delay value in seconds */
  baseDelay: number;
  /** Modifier value in seconds */
  modifier: number;
  /** The random portion added in seconds */
  randomComponent: number;
}

/**
 * Calculate random delay using base + random(0 to modifier) formula
 * @param baseDelay - Base delay in seconds
 * @param delayModifier - Maximum additional random delay in seconds
 * @returns Delay calculation with milliseconds and components
 */
export const calculateRandomDelay = (
  baseDelay: number,
  delayModifier: number
): DelayCalculation => {
  const randomComponent = Math.random() * delayModifier;
  const delaySec = baseDelay + randomComponent;
  const delayMs = Math.round(delaySec * 1000);

  return {
    delayMs,
    delaySec: parseFloat(delaySec.toFixed(2)), // Round to 2 decimals for display
    baseDelay,
    modifier: delayModifier,
    randomComponent: parseFloat(randomComponent.toFixed(2)),
  };
};
