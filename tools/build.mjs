import {
  mkdir,
  copyFile,
  readFile,
  writeFile,
  readdir,
  stat,
} from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = resolve("dist"),
  files = [];
async function copy(source, dest = source) {
  const target = resolve(root, dest);
  if (!target.startsWith(root + "\\") && !target.startsWith(root + "/"))
    throw Error("Invalid build path");
  await mkdir(join(target, ".."), { recursive: true });
  await copyFile(source, target);
  files.push(dest.replaceAll("\\", "/"));
}
async function folder(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await folder(p);
    else await copy(p);
  }
}
await mkdir(root, { recursive: true });
for (const file of [
  "index.html",
  "styles.css",
  "_headers",
  "README.md",
  "ASSETS.md",
  "DEPLOYMENT.md",
  "VERIFICATION.md",
  "IMPLEMENTATION.md",
])
  await copy(file);
await folder("src");
// Content-version every source module so returning players cannot mix releases.
const versions = Object.fromEntries(
  await Promise.all(
    files
      .filter((f) => f.startsWith("src/") && f.endsWith(".js"))
      .map(async (f) => {
        const digest = createHash("sha256")
          .update(await readFile(join(root, f)))
          .digest("hex")
          .slice(0, 12);
        return ["./" + f, "./" + f + "?v=" + digest];
      }),
  ),
);
let html = await readFile(join(root, "index.html"), "utf8");
html = html.replace(
  /(<script type="importmap">)([\s\S]*?)(<\/script>)/,
  (_, open, body, close) => {
    const map = JSON.parse(body);
    Object.assign(map.imports, versions);
    return open + JSON.stringify(map) + close;
  },
);
html = html.replace(
  'src="./src/main.js"',
  `src="${versions["./src/main.js"]}"`,
);
await writeFile(join(root, "index.html"), html);
await folder("vendor");
await folder("assets/art");
for (const f of [
  "data-sources/README.md",
  "data-sources/pune/source-metadata.json",
  "data-sources/pune/expansion-metadata.json",
  "data-sources/pune/bounds.geojson",
  "data-sources/pune/query.overpassql",
  "data-sources/pune/PLAN.md",
])
  await copy(f);
const base = "assets/cities/pune",
  manifest = JSON.parse(await readFile(base + "/manifest.json", "utf8"));
for (const f of [
  "manifest.json",
  "attribution.json",
  "import-report.json",
  "routes.json",
  "DATABASE-LICENSE.txt",
  "source.osm.json.gz",
  manifest.navigation,
  manifest.navigation + ".gz",
  ...manifest.chunks.flatMap((c) => [c.file, c.file + ".gz"]),
])
  await copy(base + "/" + f);
for (const f of files)
  if ((await stat(join(root, f))).size >= 25 * 1024 * 1024)
    throw Error("File exceeds hosting limit: " + f);
await writeFile("dist-files.json", JSON.stringify(files));
const packageZip = !process.argv.includes("--no-zip");
if (packageZip)
  execFileSync("python", ["tools/package-site.py"], { stdio: "inherit" });
console.log(
  "Static site: dist/; " +
    (packageZip ? "itch.io upload: wanderlane-pune.zip; " : "") +
    files.length +
    " files.",
);
