const traverse = require('@babel/traverse').default;
const generator = require('@babel/generator').default;
const t = require('@babel/types');
const parser = require('@babel/parser');

/**
 * Stage 1: String Deobfuscation
 * Decrypts obfuscated strings by rotating the string array and replacing decoder calls.
 */
async function run(ast) {
    console.log('[Stage 1] Starting String Deobfuscation...');
    
    const code = generator(ast).code;
    
    // 1. Extract rotation parameters from IIFE pattern
    const { arrayFuncName, rotationTarget } = extractRotationParams(code);
    console.log(`[Stage 1] Array Function: ${arrayFuncName}, Rotation Target: 0x${rotationTarget.toString(16)}`);

    // 2. Extract string array from AST
    const stringArray = extractStringArray(ast, arrayFuncName);
    if (stringArray.length === 0) {
        throw new Error('Failed to extract string array');
    }

    // 3. Extract decode offset
    const decodeOffset = extractDecodeOffset(code);
    console.log(`[Stage 1] Decode Offset: 0x${decodeOffset.toString(16)}`);

    // 4. Build decode function and checksum calculator
    const decode = (index) => stringArray[index - decodeOffset];
    const checksumFunc = buildChecksumFunc(code);

    // 5. Rotate array until checksum matches
    console.log('[Stage 1] Rotating string array...');
    rotateArray(stringArray, rotationTarget, checksumFunc, decode);

    // 6. Replace decoder calls with literal strings
    console.log('[Stage 1] Replacing decoder calls...');
    replaceDecoderCalls(ast, decode);

    // 7. Cleanup unused aliases and obfuscation artifacts
    console.log('[Stage 1] Cleaning up...');
    return cleanup(ast, arrayFuncName);
}

// --- Helper Functions ---

function extractRotationParams(code) {
    const regex = /\}\)\s*\((_0x[a-f0-9]+),\s*(0x[a-f0-9]+)\);/m;
    const match = code.match(regex);
    if (!match) throw new Error('Failed to find rotation IIFE signature');
    return {
        arrayFuncName: match[1],
        rotationTarget: parseInt(match[2], 16)
    };
}

function extractStringArray(ast, arrayFuncName) {
    let stringArray = [];
    traverse(ast, {
        FunctionDeclaration(path) {
            if (path.node.id?.name === arrayFuncName) {
                const varDecl = path.node.body.body.find(s => t.isVariableDeclaration(s));
                const init = varDecl?.declarations[0]?.init;
                if (t.isArrayExpression(init)) {
                    stringArray = init.elements.map(el => el.value);
                }
            }
        }
    });
    return stringArray;
}

function extractDecodeOffset(code) {
    const regex = /(_0x[a-f0-9]{1,6})\s*=\s*\1\s*-\s*(0x[a-f0-9]{1,9});/i;
    const match = code.match(regex);
    if (!match?.[2]) throw new Error('Failed to detect decode offset');
    return parseInt(match[2], 16);
}

function buildChecksumFunc(code) {
    const regex = /const _0x[a-z0-9]{6} =\n*\s+?(-*parseInt[\s\S]+?);/m;
    const match = code.match(regex);
    if (!match) throw new Error('Failed to extract checksum logic');
    
    const logic = match[1].trim().replaceAll(/_0x[a-z0-9]{6}/g, 'decode');
    return new Function('decode', 'return ' + logic + ';');
}

function rotateArray(array, target, checksumFunc, decode) {
    while (true) {
        try {
            if (checksumFunc(decode) === target) break;
        } catch {}
        array.push(array.shift());
    }
}

function replaceDecoderCalls(ast, decode) {
    traverse(ast, {
        CallExpression(path) {
            const { arguments: args } = path.node;
            if (args.length === 1 && (t.isNumericLiteral(args[0]) || t.isStringLiteral(args[0]))) {
                const decoded = decode(args[0].value);
                if (typeof decoded === 'string') {
                    path.replaceWith(t.stringLiteral(decoded));
                }
            }
        }
    });
}

function cleanup(ast, arrayFuncName) {
    let currentCode = generator(ast).code;
    
    // Pass 1: Remove unused aliases iteratively
    let removed;
    do {
        removed = 0;
        const tempAst = parser.parse(currentCode, { sourceType: 'module' });
        traverse(tempAst, {
            VariableDeclarator(path) {
                if (t.isIdentifier(path.node.id) && t.isIdentifier(path.node.init)) {
                    const binding = path.scope.getBinding(path.node.id.name);
                    if (binding?.referencePaths.length === 0) {
                        path.remove();
                        removed++;
                    }
                }
            }
        });
        if (removed > 0) currentCode = generator(tempAst).code;
    } while (removed > 0);

    // Pass 2: Remove string array function and checksum IIFE
    const finalAst = parser.parse(currentCode, { sourceType: 'module' });
    traverse(finalAst, {
        FunctionDeclaration(path) {
            if (path.node.id?.name === arrayFuncName) {
                path.remove();
                console.log(`[Stage 1] Removed: ${arrayFuncName}`);
            }
        },
        VariableDeclarator(path) {
            if (path.node.id?.name === arrayFuncName) {
                path.remove();
                console.log(`[Stage 1] Removed (var): ${arrayFuncName}`);
            }
        },
        // Remove checksum rotation IIFE: (function(...) { ... })(_0xArray, 0xTarget);
        ExpressionStatement(path) {
            const expr = path.node.expression;
            if (t.isCallExpression(expr) && t.isFunctionExpression(expr.callee)) {
                const args = expr.arguments;
                if (args.length === 2 && 
                    t.isIdentifier(args[0]) && args[0].name === arrayFuncName &&
                    t.isNumericLiteral(args[1])) {
                    path.remove();
                    console.log(`[Stage 1] Removed checksum IIFE`);
                }
            }
        }
    });

    return finalAst;
}

module.exports = { run };
