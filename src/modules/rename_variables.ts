import traverse from "@babel/traverse";

import type { ParseResult } from "@babel/parser";
import type { File } from "@babel/types";

interface RenameEntry {
  from: string;
  to: string;
}

/**
 * Dynamically detect require() calls and rename variables to module_XXX format.
 */
function detectRequireRenames(ast: ParseResult<File>): RenameEntry[] {
  const dynamicRenames: RenameEntry[] = [];

  traverse(
    ast,
    {
      VariableDeclarator(path) {
        const init = path.node.init;
        // Check: var x = require("module-name")
        if (
          init?.type === "CallExpression" &&
          init.callee?.type === "Identifier" &&
          init.callee.name === "require" &&
          init.arguments[0]?.type === "StringLiteral" &&
          path.node.id?.type === "Identifier"
        ) {
          const varName = path.node.id.name;
          const moduleName = init.arguments[0].value;
          // Convert module name to valid identifier: electron-updater -> electron_updater
          const safeName = moduleName.replace(/[-/@.]/g, "_");
          const newName = `module_${safeName}`;

          dynamicRenames.push({ from: varName, to: newName });
        }
      },
    },
    undefined,
    { noScope: true },
  ); // noScope for faster traversal (detection only)

  return dynamicRenames;
}

export function run(ast: ParseResult<File>): ParseResult<File> {
  console.log("[Stage 2] Starting Symbol Renaming...");

  // First, detect require() calls and rename them dynamically
  const requireRenames = detectRequireRenames(ast);
  console.log(`Detected ${requireRenames.length} require() calls for dynamic renaming`);

  let renamedCount = 0;
  traverse(ast, {
    Program(path) {
      const scope = path.scope;

      // Apply dynamic require renames first
      for (const { from: oldName, to: newName } of requireRenames) {
        if (scope.hasBinding(oldName)) {
          console.log(`Renaming ${oldName} -> ${newName} (require)`);
          scope.rename(oldName, newName);
          renamedCount++;
        }
      }
    },
  });

  console.log(`Renamed ${renamedCount} symbols.`);
  return ast;
}
