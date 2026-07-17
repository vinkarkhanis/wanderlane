// Shared height field so road, ground and car all agree on elevation.
export function heightAt(x, z) {
  return Math.sin(x * .008) * 9 + Math.cos(z * .006) * 11 + Math.sin((x + z) * .02) * 2;
}
