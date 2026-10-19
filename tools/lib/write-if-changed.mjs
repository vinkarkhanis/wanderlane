import { readFile, writeFile as write } from "node:fs/promises";

// Keep unchanged prepared assets in place, including content-addressed chunks.
// This also avoids needless file watcher activity during a cached map rebuild.
export async function writeFile(path, content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
  try {
    if ((await readFile(path)).equals(bytes)) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await write(path, bytes);
}
