const path = require('path');
const decryptStrings = require('./modules/decrypt_strings');
const renameVariables = require('./modules/rename_variables');
const simplifyStructure = require('./modules/simplify_structure');
const renameLocals = require('./modules/rename_locals');

const { readAst, writeAst } = require('./utils/io');

// Paths
const MAIN_DIR = path.resolve(__dirname, '../output');
const PATHS = {
    input: "original/main_haoplay_tcob.js",
    unminified_output: path.join(MAIN_DIR, '00_unminified.js'),
    stage1_output: path.join(MAIN_DIR, '01_decrypted_strings.js'),
    structure_output: path.join(MAIN_DIR, '02_simplified_structure.js'),
    locals_output: path.join(MAIN_DIR, '03_renamed_locals.js'),
    final_output: path.join(MAIN_DIR, '04_renamed_symbols.js'),
};

async function main() {
    console.log('=== Starting Deobfuscation Pipeline ===');
    
    // Initial Read
    const { ast } = await readAst(PATHS.input);
    let currentAst = ast;

    // Stage 0: Unminify (Format)
    console.log('\n--- Stage 0: Unminify ---');
    await writeAst(PATHS.unminified_output, currentAst);

    // Stage 1: String Extraction & Rotation
    console.log('\n--- Stage 1: Decrypt Strings ---');
    currentAst = await decryptStrings.run(currentAst);
    await writeAst(PATHS.stage1_output, currentAst);
    
    // Stage 2: Structural Deobfuscation (Full Mode)
    console.log('\n--- Stage 2: Simplify Structure ---');
    currentAst = await simplifyStructure.run(currentAst, { mode: 'full' });
    await writeAst(PATHS.structure_output, currentAst);

    // Stage 3: Local Variable Renaming
    console.log('\n--- Stage 3: Rename Local Variables ---');
    currentAst = await renameLocals.run(currentAst);
    await writeAst(PATHS.locals_output, currentAst);

    // Stage 4: Rename Variables (includes inferred names)
    console.log('\n--- Stage 4: Rename Variables ---');
    currentAst = await renameVariables.run(currentAst);
    await writeAst(PATHS.final_output, currentAst);

    console.log('\n=== Deobfuscation Complete ===');
    console.log(`Output: ${PATHS.final_output}`);
        
}

main();
