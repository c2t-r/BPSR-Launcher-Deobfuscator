# BPSR Launcher Deobfuscator

A tool for deobfuscating the BPSR launcher's compiled electron code.

## Features

This tool deobfuscates `resources/app/dist/electron/main.js` through a 4-stage pipeline:

1. **DecryptStrings** - Decrypts the encrypted string array and replaces decoder calls with actual strings
2. **SimplifyStructure** - Simplifies structure (literal normalization, helper function cleanup, polyfill removal, etc.)
3. **RenameLocals** - Renames local variables (function arguments, loop variables, catch clauses, etc.)
4. **RenameVariables** - Detects `require()` calls and renames them to `module_XXX` format

## Requirements

- Bun (not for API, for runtime)

## Installation

```bash
bun install
```

## Usage

```bash
bun run deobfuscate <input> <output>
```

### Example

```bash
bun run deobfuscate ./main.js ./deobfuscated.main.js
```
