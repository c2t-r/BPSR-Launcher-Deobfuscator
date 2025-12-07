import generator from "@babel/generator";
import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

import { createLogger } from "../utils/logger.ts";

import type { ParseResult } from "@babel/parser";
import type { File } from "@babel/types";

const log = createLogger("Module: DecryptStrings");

/**
 * Decrypts obfuscated strings by rotating the string array and replacing decoder calls.
 */
export function run(ast: ParseResult<File>): ParseResult<File> {
  log.info("Starting...");

  const code = generator(ast).code;

  // 1. Extract rotation parameters from IIFE pattern
  const { arrayFuncName, rotationTarget } = extractRotationParams(code);
  log.detail(`Array: ${arrayFuncName}, Target: 0x${rotationTarget.toString(16)}`);

  // 2. Extract string array from AST
  const stringArray = extractStringArray(ast, arrayFuncName);
  if (stringArray.length === 0) {
    throw new Error("Failed to extract string array");
  }

  // 3. Extract decode offset
  const decodeOffset = extractDecodeOffset(code);
  log.detail(`Decode Offset: 0x${decodeOffset.toString(16)}`);

  // 4. Build decode function and checksum calculator
  const decode = (index: number): string | undefined => stringArray[index - decodeOffset];
  const checksumFunc = buildChecksumFunc(code);

  // 5. Rotate array until checksum matches
  log.detail("Rotating string array...");
  rotateArray(stringArray, rotationTarget, checksumFunc, decode);

  // 6. Replace decoder calls with literal strings
  log.detail("Replacing decoder calls...");
  replaceDecoderCalls(ast, decode);

  // 7. Cleanup unused aliases and obfuscation artifacts
  log.detail("Cleaning up...");
  const result = cleanup(ast, arrayFuncName);
  log.info("Done");
  return result;
}

// --- Helper Functions ---

interface RotationParams {
  arrayFuncName: string;
  rotationTarget: number;
}

function extractRotationParams(code: string): RotationParams {
  const regex = /\}\)\s*\((_0x[a-f0-9]+),\s*(0x[a-f0-9]+)\);/m;
  const match = code.match(regex);
  if (!match) throw new Error("Failed to find rotation IIFE signature");
  return {
    arrayFuncName: match[1]!,
    rotationTarget: parseInt(match[2]!, 16),
  };
}

function extractStringArray(ast: ParseResult<File>, arrayFuncName: string): string[] {
  let stringArray: string[] = [];
  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id?.name === arrayFuncName) {
        const varDecl = path.node.body.body.find((s) => t.isVariableDeclaration(s));
        if (varDecl && t.isVariableDeclaration(varDecl)) {
          const init = varDecl.declarations[0]?.init;
          if (t.isArrayExpression(init)) {
            stringArray = init.elements.map((el) => (t.isStringLiteral(el) ? el.value : ""));
          }
        }
      }
    },
  });
  return stringArray;
}

function extractDecodeOffset(code: string): number {
  const regex = /(_0x[a-f0-9]{1,6})\s*=\s*\1\s*-\s*(0x[a-f0-9]{1,9});/i;
  const match = code.match(regex);
  if (!match?.[2]) throw new Error("Failed to detect decode offset");
  return parseInt(match[2], 16);
}

type DecodeFunc = (index: number) => string | undefined;

function buildChecksumFunc(code: string): (decode: DecodeFunc) => number {
  const regex = /const _0x[a-z0-9]{6} =\n*\s+?(-*parseInt[\s\S]+?);/m;
  const match = code.match(regex);
  if (!match) throw new Error("Failed to extract checksum logic");

  const logic = match[1]!.trim().replaceAll(/_0x[a-z0-9]{6}/g, "decode");
  // Dynamically construct the checksum function from obfuscated code
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function("decode", "return " + logic + ";") as (decode: DecodeFunc) => number;
}

function rotateArray(
  array: string[],
  target: number,
  checksumFunc: (decode: DecodeFunc) => number,
  decode: DecodeFunc,
): void {
  while (true) {
    try {
      if (checksumFunc(decode) === target) break;
    } catch {
      // Rotation failed, try next shift
    }
    array.push(array.shift()!);
  }
}

function replaceDecoderCalls(ast: ParseResult<File>, decode: DecodeFunc): void {
  traverse(ast, {
    CallExpression(path) {
      const { arguments: args } = path.node;
      if (args.length === 1 && (t.isNumericLiteral(args[0]) || t.isStringLiteral(args[0]))) {
        const arg = args[0];
        const value = t.isNumericLiteral(arg) ? arg.value : Number(arg.value);
        const decoded = decode(value);
        if (typeof decoded === "string") {
          path.replaceWith(t.stringLiteral(decoded));
        }
      }
    },
  });
}

function cleanup(ast: ParseResult<File>, arrayFuncName: string): ParseResult<File> {
  let currentCode = generator(ast).code;

  // Pass 1: Remove unused aliases iteratively
  let removed: number;
  do {
    removed = 0;
    const tempAst = parser.parse(currentCode, { sourceType: "module" });
    traverse(tempAst, {
      VariableDeclarator(path) {
        if (t.isIdentifier(path.node.id) && t.isIdentifier(path.node.init)) {
          const binding = path.scope.getBinding(path.node.id.name);
          if (binding?.referencePaths.length === 0) {
            path.remove();
            removed++;
          }
        }
      },
    });
    if (removed > 0) currentCode = generator(tempAst).code;
  } while (removed > 0);

  // Pass 2: Remove string array function and checksum IIFE
  const finalAst = parser.parse(currentCode, { sourceType: "module" });
  traverse(finalAst, {
    FunctionDeclaration(path) {
      if (path.node.id?.name === arrayFuncName) {
        path.remove();
        log.detail(`Removed: ${arrayFuncName}`);
      }
    },
    VariableDeclarator(path) {
      if (t.isIdentifier(path.node.id) && path.node.id.name === arrayFuncName) {
        path.remove();
        log.detail(`Removed (var): ${arrayFuncName}`);
      }
    },
    // Remove checksum rotation IIFE: (function(...) { ... })(_0xArray, 0xTarget);
    ExpressionStatement(path) {
      const expr = path.node.expression;
      if (t.isCallExpression(expr) && t.isFunctionExpression(expr.callee)) {
        const args = expr.arguments;
        if (
          args.length === 2 &&
          t.isIdentifier(args[0]) &&
          args[0].name === arrayFuncName &&
          t.isNumericLiteral(args[1])
        ) {
          path.remove();
          log.detail("Removed checksum IIFE");
        }
      }
    },
  });

  return finalAst;
}
