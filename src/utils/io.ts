import * as fs from "fs";

import generator from "@babel/generator";
import * as parser from "@babel/parser";
import * as prettier from "prettier";

import type { ParseResult } from "@babel/parser";
import type { File } from "@babel/types";

export function readAst(filePath: string): {
  ast: ParseResult<File>;
  code: string;
} {
  console.log(`Reading ${filePath}...`);
  const code = fs.readFileSync(filePath, "utf8");
  return {
    ast: parser.parse(code, {
      sourceType: "module",
      startLine: 1,
    }),
    code,
  };
}

export async function writeAst(
  filePath: string,
  ast: ParseResult<File>,
  code: string | null = null,
): Promise<void> {
  const output = generator(
    ast,
    {
      /* options if any */
    },
    code ?? undefined,
  ).code; // passing original code helps preserve formatting if needed, but we mostly regenerate

  const formatted = await prettier.format(output, { parser: "babel" });

  fs.writeFileSync(filePath, formatted);
}
