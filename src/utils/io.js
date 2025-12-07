const fs = require('fs');
const parser = require('@babel/parser');
const generator = require('@babel/generator').default;
const prettier = require('prettier');

async function readAst(filePath) {
    console.log(`Reading ${filePath}...`);
    const code = fs.readFileSync(filePath, 'utf8');
    return {
        ast: parser.parse(code, {
            sourceType: 'module',
            startLine: 1,
        }),
        code
    };
}

async function writeAst(filePath, ast, code = null) {
    const output = generator(ast, {
        /* options if any */
    }, code).code; // passing original code helps preserve formatting if needed, but we mostly regenerate

    const formatted = await prettier.format(output, { parser: 'babel' });
    
    fs.writeFileSync(filePath, formatted);
}

module.exports = {
    readAst,
    writeAst
};
