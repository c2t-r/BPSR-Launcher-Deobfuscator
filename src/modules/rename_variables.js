const traverse = require('@babel/traverse').default;

const { readAst, writeAst } = require('../utils/io');

/**
 * Dynamically detect require() calls and rename variables to module_XXX format.
 * @param {object} ast - The AST to process
 * @returns {Array<{from: string, to: string}>} - Array of dynamic renames
 */
function detectRequireRenames(ast) {
    const dynamicRenames = [];
    
    traverse(ast, {
        VariableDeclarator(path) {
            const init = path.node.init;
            // Check: var x = require("module-name")
            if (init?.type === 'CallExpression' &&
                init.callee?.type === 'Identifier' &&
                init.callee.name === 'require' &&
                init.arguments[0]?.type === 'StringLiteral' &&
                path.node.id?.type === 'Identifier') {
                
                const varName = path.node.id.name;
                const moduleName = init.arguments[0].value;
                // Convert module name to valid identifier: electron-updater -> electron_updater
                const safeName = moduleName.replace(/[-\/\.@]/g, '_');
                const newName = `module_${safeName}`;
                
                dynamicRenames.push({ from: varName, to: newName });
            }
        }
    }, null, { noScope: true }); // noScope for faster traversal (detection only)
    
    return dynamicRenames;
}

// hardcoded renaming rules should be deprecated, dynamic renaming should be used instead. this variable is archived
const renames = [
    { from: 'os', to: 'trayUrl' }, 
    { from: 'Be', to: 'formatUrl' },
    { from: 'Pa', to: 'indexHtmlUrl' }, 
    { from: 'ns', to: 'loaderUrl' },    
    { from: 'ts', to: 'staticUrl' },    
    { from: 'D', to: 'appConfig' },     
    { from: 'yn', to: 'trayIconPath' },
    { from: 'mi', to: 'globalObj' },    
    { from: 'wn', to: 'unwrapModule' }, 
    { from: 'cp', to: 'UpdateManager' },
    { from: 'da', to: 'definePropHelper' },
    { from: 'Pe', to: 'updateFeedUrl' },
    { from: 'jo', to: 'getBackupFeedUrl' },
    { from: 'rp', to: 'definePropertyData' }, 
    { from: 'y', to: 'ipcChannels' },
    { from: 'cn', to: 'ipcHandlers' },
    { from: 'O', to: 'auxWindow' },
    { from: 'Ae', to: 'settingWindow' },
    { from: 'F', to: 'mainWindowRef' },
    { from: 'ud', to: 'WindowManager' },
    { from: 'ge', to: 'createWindow' },
    { from: 'te', to: 'createNotifyWin' },
    { from: 'Xu', to: 'registerIpc' },
    { from: 'Zu', to: 'captureScreen' },
    { from: 'si', to: 'sendTo' },
    { from: 'mu', to: 'mainWindowOptions' },
    { from: 'Qi', to: 'childWindowOptions' },
    { from: 'Xi', to: 'mergeOpts' },
    { from: 'G', to: 'PromiseUtils' },
    { from: 'ee', to: 'exportsObj' },
    { from: 'Se', to: 'fsConstants' },
    { from: 'ss', to: 'originalCwd' },
    { from: '$a', to: 'cwdCache' },
    { from: 'kn', to: 'originalChdir' },
    { from: 'ps', to: 'patchFsMethods' },
    { from: 'cs', to: 'patchFsMethodsExport' },
    { from: 'fs', to: 'gracefulFs' }, 
    { from: 'ke', to: 'isDevelopment' },
    { from: 'di', to: 'FALSE_VAL' },
    { from: 'Xt', to: 'TRUE_VAL' },
    { from: 'Zt', to: 'HOT_UPDATE_DIR_NAME' },
    { from: 'is', to: 'PathManager' },
    { from: 'pe', to: 'paths' },
    
    // New renames moved from simplify_structure.js
    { from: 'm', to: 'fsUtil' }, // fs-extra
    { from: '_', to: 'aria2Client' },  // aria2 client
    { from: 'j', to: 'saveConfig' }, // save config function (async)
    { from: 'k', to: 'configDir' }, // variable
    { from: 'g', to: 'globalState' }, // global state object
    { from: 'Wc', to: 'getBranchList' },
    { from: 'La', to: 'packageJson' },
    { from: 'Zc', to: 'bugReportUrl' },
    { from: 'Lt', to: 'isBugReported' },
    { from: 'Na', to: 'getLatestVersion' },
    { from: 'rn', to: 'getUpdateUrl' },
    { from: 'he', to: 'getPlatform' },
    { from: 'Hu', to: 'checkGameExists' },
    { from: 'Xa', to: 'checkUpdate' },
    { from: 'Qu', to: 'startGameDownload' },
    { from: 'Mu', to: 'pauseGameDownload' },
    { from: 'hu', to: 'pauseGameUpdate' },
    { from: 'Gu', to: 'resumeGameDownload' },
    { from: 'gu', to: 'resumeGameUpdate' },
    { from: 'Ot', to: 'closeApp' },
    { from: 'Pt', to: 'updateGame' },
    { from: 'Ku', to: 'repairGame' },
    { from: 'Jc', to: 'removeConfig' },
    { from: 'id', to: 'checkDiskSpace' },
    { from: 'ad', to: 'checkArg' },
    { from: 'od', to: 'showAbout' },
    { from: 'td', to: 'createTray' },
    { from: 'sd', to: 'createTrayWindow' },
    { from: 'Yu', to: 'initMainWindow' },
    { from: 'Vc', to: 'getConfig' },
    { from: 'It', to: 'launchGameProcess' }
];

async function run(ast) {
    console.log('[Stage 2] Starting Symbol Renaming...');

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
            
            // Then apply static renames
            for (const { from: oldName, to: newName } of renames) {
                break
                if (scope.hasBinding(oldName)) {
                    console.log(`Renaming ${oldName} -> ${newName}`);
                    scope.rename(oldName, newName);
                    renamedCount++;
                }
            }
        }
    });

    console.log(`Renamed ${renamedCount} symbols.`);
    return ast;
}

module.exports = { run };

