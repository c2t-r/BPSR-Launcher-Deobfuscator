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

### input (formatted)

```js
      const _0x4a0d23 = l[_0xe4a861(0x8ca)](k, _0xe4a861(0x2b1));
      try {
        await m['stat'](_0x4a0d23), await m[_0xe4a861(0x65b)](_0x4a0d23), console['log'](_0xe4a861(0x7d6));
      } catch (_0x131c7f) {
        if (_0x131c7f[_0xe4a861(0x366)] === _0xe4a861(0x293)) try {
          await m[_0xe4a861(0x82b)](_0x4a0d23, {
            'recursive': !0x0
          });
        } catch (_0x50869f) {
          console['log']('mkdir\x20Error', _0x50869f);
        } else console['log'](_0xe4a861(0x7f4), _0x131c7f);
      }
      try {
        const _0x4dbe31 = await Na(),
          _0x18eb1d = await np();
        await m[_0xe4a861(0x359)](l[_0xe4a861(0x8ca)](_0x4a0d23, _0xe4a861(0x516)), _0x4dbe31), await m['writeFile'](l[_0xe4a861(0x8ca)](_0x4a0d23, _0xe4a861(0x4bd)), _0x18eb1d);
```

### output

```js
      const _0x4a0d23 = module_path.join(k, "temp");
      try {
        (await m.stat(_0x4a0d23),
          await m.emptyDir(_0x4a0d23),
          console.log(
            "\u6E05\u7A7Atemp\u6587\u4EF6\u5939\u6210\u529F isGameUpdate",
          ));
      } catch (_err69) {
        if (_err69.code === "ENOENT")
          try {
            await m.mkdir(_0x4a0d23, {
              recursive: true,
            });
          } catch (_err70) {
            console.log("mkdir\x20Error", _err70);
          }
        else console.log("stat tempPath Error", _err69);
      }
      try {
        const _0x4dbe31 = await Na(),
          _0x18eb1d = await np();
        (await m.writeFile(
          module_path.join(_0x4a0d23, "verlist.txt"),
          _0x4dbe31,
        ),
          await m.writeFile(
            module_path.join(_0x4a0d23, "md5list.txt"),
            _0x18eb1d,
          ));
```
