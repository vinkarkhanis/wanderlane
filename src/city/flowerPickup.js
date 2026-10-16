// Shared timing for the parked interaction, character animation and HUD.
export const FLOWER_PICKUP_SECONDS = 9;
export function flowerPickupStage(elapsed) {
  return elapsed < 2
    ? "collecting bouquet"
    : elapsed < 5
      ? "carrying to car"
      : elapsed < 7.5
        ? "placing on passenger seat"
        : elapsed < 9
          ? "stepping clear"
          : "ready to drive";
}
