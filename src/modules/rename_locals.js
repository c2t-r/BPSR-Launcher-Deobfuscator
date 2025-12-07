const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const { readAst, writeAst } = require('../utils/io');

function isObfuscated(name) {
    return /^_[0-9a-zA-Z]+$/.test(name) || /^[a-zA-Z]{1,2}$/.test(name);
}

async function run(ast) {
    console.log('[Stage 4] Starting Local Variable Renaming...');
    // const { ast } = await readAst(inputPath); // AST passed in

    traverse(ast, {
        // 1. Rename Function Arguments
        Function(path) {
            let argIndex = 0;
            path.node.params.forEach(param => {
                if (t.isIdentifier(param)) {
                    if (isObfuscated(param.name)) {
                        const newName = path.scope.generateUid(`arg${argIndex}`);
                        path.scope.rename(param.name, newName);
                    }
                    argIndex++;
                }
            });
        },

        // 2. Rename Catch Parameters
        CatchClause(path) {
            const param = path.node.param;
            if (param && t.isIdentifier(param)) {
                if (isObfuscated(param.name)) {
                    const newName = path.scope.generateUid('err');
                    path.scope.rename(param.name, newName);
                }
            }
        },

        // 3. Rename Loop Variables
        ForStatement(path) {
            const init = path.node.init;
            if (t.isVariableDeclaration(init) && init.declarations.length > 0) {
                const decl = init.declarations[0];
                if (t.isIdentifier(decl.id) && isObfuscated(decl.id.name)) {
                    // Simpleheuristic: normally i
                    const newName = path.scope.generateUid('i');
                    path.scope.rename(decl.id.name, newName);
                }
            }
        },
        ForInStatement(path) {
             const left = path.node.left;
             if (t.isVariableDeclaration(left)) {
                 const decl = left.declarations[0];
                 if (t.isIdentifier(decl.id) && isObfuscated(decl.id.name)) {
                     const newName = path.scope.generateUid('key');
                     path.scope.rename(decl.id.name, newName);
                 }
             } else if (t.isIdentifier(left) && isObfuscated(left.name)) {
                 const newName = path.scope.generateUid('key');
                 path.scope.rename(left.name, newName);
             }
        },
        ForOfStatement(path) {
            const left = path.node.left;
            if (t.isVariableDeclaration(left)) {
                const decl = left.declarations[0];
                if (t.isIdentifier(decl.id) && isObfuscated(decl.id.name)) {
                    const newName = path.scope.generateUid('item');
                    path.scope.rename(decl.id.name, newName);
                }
            } else if (t.isIdentifier(left) && isObfuscated(left.name)) {
                const newName = path.scope.generateUid('item');
                path.scope.rename(left.name, newName);
            }
       }
    });

    // await writeAst(outputPath, ast); // Skip writing
    return ast;
}

module.exports = { run };
