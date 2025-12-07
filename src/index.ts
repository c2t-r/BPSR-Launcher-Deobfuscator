import * as decryptStrings from "./modules/decrypt_strings.ts";
import * as renameLocals from "./modules/rename_locals.ts";
import * as renameVariables from "./modules/rename_variables.ts";
import * as simplifyStructure from "./modules/simplify_structure.ts";
import { readAst, writeAst } from "./utils/io.ts";
import { createLogger } from "./utils/logger.ts";

const log = createLogger("Deobfuscator");

function parseArgs(): { inputPath: string; outputPath: string } {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error("Usage: bun run deobfuscate <input.js> <output.js>");
    process.exit(1);
  }
  return { inputPath, outputPath };
}

async function main(): Promise<void> {
  const { inputPath, outputPath } = parseArgs();
  log.info(`${inputPath} -> ${outputPath}`);

  let { ast } = readAst(inputPath);

  ast = decryptStrings.run(ast);
  ast = simplifyStructure.run(ast);
  ast = renameLocals.run(ast);
  ast = renameVariables.run(ast);

  await writeAst(outputPath, ast);
  log.info("Complete!");
}

void main();
