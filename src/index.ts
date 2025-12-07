import * as path from "path";

import * as decryptStrings from "./modules/decrypt_strings.ts";
import * as renameLocals from "./modules/rename_locals.ts";
import * as renameVariables from "./modules/rename_variables.ts";
import * as simplifyStructure from "./modules/simplify_structure.ts";
import { readAst, writeAst } from "./utils/io.ts";

// Paths
const mainDir = path.resolve(import.meta.dirname, "../output");
const paths = {
  input: "original/main_haoplay_tcob.js",
  unminifiedOutput: path.join(mainDir, "00_unminified.js"),
  stage1Output: path.join(mainDir, "01_decrypted_strings.js"),
  structureOutput: path.join(mainDir, "02_simplified_structure.js"),
  localsOutput: path.join(mainDir, "03_renamed_locals.js"),
  finalOutput: path.join(mainDir, "04_renamed_symbols.js"),
};

async function main(): Promise<void> {
  console.log("=== Starting Deobfuscation Pipeline ===");

  // Initial Read
  const { ast } = readAst(paths.input);
  let currentAst = ast;

  // Stage 0: Unminify (Format)
  console.log("\n--- Stage 0: Unminify ---");
  await writeAst(paths.unminifiedOutput, currentAst);

  // Stage 1: String Extraction & Rotation
  console.log("\n--- Stage 1: Decrypt Strings ---");
  currentAst = decryptStrings.run(currentAst);
  await writeAst(paths.stage1Output, currentAst);

  // Stage 2: Structural Deobfuscation (Full Mode)
  console.log("\n--- Stage 2: Simplify Structure ---");
  currentAst = simplifyStructure.run(currentAst);
  await writeAst(paths.structureOutput, currentAst);

  // Stage 3: Local Variable Renaming
  console.log("\n--- Stage 3: Rename Local Variables ---");
  currentAst = renameLocals.run(currentAst);
  await writeAst(paths.localsOutput, currentAst);

  // Stage 4: Rename Variables (includes inferred names)
  console.log("\n--- Stage 4: Rename Variables ---");
  currentAst = renameVariables.run(currentAst);
  await writeAst(paths.finalOutput, currentAst);

  console.log("\n=== Deobfuscation Complete ===");
  console.log(`Output: ${paths.finalOutput}`);
}

void main();
