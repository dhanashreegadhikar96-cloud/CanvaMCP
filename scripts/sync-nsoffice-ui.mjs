// Copies the NSOffice UI kit's static files (nsoffice_ui/static) to public/nsoffice-ui/static,
// the same URL the Flask blueprint serves them at. Runs before `dev` and `build`.
// Edit the kit in nsoffice_ui/, never the generated copy in public/.
import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "nsoffice-ui", "static");

rmSync(target, { recursive: true, force: true });
cpSync(join(root, "nsoffice_ui", "static"), target, { recursive: true });
console.log("nsoffice_ui/static -> public/nsoffice-ui/static");
