import traverse from "@babel/traverse";
import * as t from "@babel/types";

import type { ParseResult } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import type {
  AssignmentExpression,
  Expression,
  File,
  Node,
  VariableDeclarator,
} from "@babel/types";

const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

export function run(ast: ParseResult<File>): ParseResult<File> {
  console.log(`[Stage 3/Clean] Starting Structure Deobfuscation...`);

  normalizeLiterals(ast);
  restoreObjectShortcuts(ast);
  cleanSymbolPolyfills(ast);
  simplifyHelperFunctions(ast);

  return ast;
}

/**
 * Check if a node is Object["prop"] or Object.prop
 */
function isObjectMember(node: Node, propName: string): boolean {
  if (!t.isMemberExpression(node)) return false;
  if (!t.isIdentifier(node.object, { name: "Object" })) return false;

  if (t.isStringLiteral(node.property)) {
    return node.property.value === propName;
  }
  if (t.isIdentifier(node.property) && !node.computed) {
    return node.property.name === propName;
  }
  return false;
}

/**
 * Check if a node is Object.prototype["prop"] or Object.prototype.prop
 */
function isObjectPrototypeMember(node: Node): string | null {
  if (!t.isMemberExpression(node)) return null;
  if (!t.isMemberExpression(node.object)) return null;
  if (!t.isIdentifier(node.object.object, { name: "Object" })) return null;

  const protoKey = node.object.property;
  const isProto =
    t.isStringLiteral(protoKey, { value: "prototype" }) ||
    t.isIdentifier(protoKey, { name: "prototype" });
  if (!isProto) return null;

  // Extract property name
  if (t.isStringLiteral(node.property)) return node.property.value;
  if (t.isIdentifier(node.property) && !node.computed) return node.property.name;
  return null;
}

/**
 * Check if a string is a valid JavaScript identifier
 */
function isValidIdentifier(str: string): boolean {
  return validIdentifierRegex.test(str);
}

/**
 * Replace all references of a binding and remove the declarator
 */
function replaceBindingReferences(
  path: NodePath<VariableDeclarator>,
  idName: string,
  replacer: (refPath: NodePath) => void,
): boolean {
  const binding = path.scope.getBinding(idName);
  if (!binding) return false;

  binding.referencePaths.forEach((refPath) => {
    replacer(refPath);
  });
  path.remove();
  return true;
}

/**
 * Create a normalized member assignment from call arguments
 */
function createMemberAssignment(
  args: (Expression | t.SpreadElement | t.ArgumentPlaceholder)[],
): AssignmentExpression {
  const obj = args[0] as Expression;
  const prop = args[1] as Expression;
  const val = args[2] as Expression | undefined;

  const member = t.memberExpression(obj, prop, true);

  // Normalize computed property if valid identifier
  if (t.isStringLiteral(prop) && isValidIdentifier(prop.value)) {
    member.computed = false;
    member.property = t.identifier(prop.value);
  }

  const assignment = t.assignmentExpression("=", member, val || t.identifier("undefined"));
  return assignment;
}

/**
 * Check if a path matches Object.assign polyfill pattern
 */
function matchesAssignPolyfill(path: NodePath): boolean {
  let hasForIn = false;
  let hasHasOwn = false;

  path.traverse({
    ForInStatement() {
      hasForIn = true;
    },
    Identifier(p) {
      if (p.node.name === "hasOwnProperty") hasHasOwn = true;
    },
    StringLiteral(p) {
      if (p.node.value === "hasOwnProperty") hasHasOwn = true;
    },
  });
  return hasForIn && hasHasOwn;
}

/**
 * Check if a path contains Symbol.asyncIterator usage
 */
function hasAsyncIteratorUsage(path: NodePath<VariableDeclarator>): boolean {
  let found = false;
  path.traverse({
    MemberExpression(p) {
      if (
        t.isIdentifier(p.node.object, { name: "Symbol" }) &&
        t.isIdentifier(p.node.property, { name: "asyncIterator" })
      ) {
        found = true;
      }
    },
  });
  return found;
}

// ============================================================================
// Transformation Passes
// ============================================================================

/**
 * Pass: Normalize literals
 * e.g., !0x0 -> true, !0x1 -> false, void 0x0 -> undefined
 */
function normalizeLiterals(ast: ParseResult<File>): void {
  console.log("Normalizing literals...");
  let boolCount = 0;
  let voidCount = 0;

  traverse(ast, {
    UnaryExpression(path) {
      const { operator, argument } = path.node;

      // !0x0 or !0 -> true
      if (operator === "!" && t.isNumericLiteral(argument) && argument.value === 0) {
        path.replaceWith(t.booleanLiteral(true));
        boolCount++;
      }
      // !0x1 or !1 -> false
      else if (operator === "!" && t.isNumericLiteral(argument) && argument.value === 1) {
        path.replaceWith(t.booleanLiteral(false));
        boolCount++;
      }
      // void 0x0 or void 0 -> undefined
      else if (operator === "void" && t.isNumericLiteral(argument) && argument.value === 0) {
        path.replaceWith(t.identifier("undefined"));
        voidCount++;
      }
    },
  });

  console.log(`Normalized ${boolCount} boolean literals, ${voidCount} void expressions`);
}

/**
 * Pass: Restore Object method shortcuts
 * e.g., var dp = Object["defineProperty"] -> replace dp with Object.defineProperty
 */
function restoreObjectShortcuts(ast: ParseResult<File>): void {
  console.log("Restoring Object shortcuts...");

  traverse(ast, {
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (!t.isIdentifier(id) || !init) return;

      let replacement: t.MemberExpression | null = null;

      // Object.defineProperty / Object.getOwnPropertySymbols
      if (isObjectMember(init, "defineProperty")) {
        replacement = t.memberExpression(t.identifier("Object"), t.identifier("defineProperty"));
      } else if (isObjectMember(init, "getOwnPropertySymbols")) {
        replacement = t.memberExpression(
          t.identifier("Object"),
          t.identifier("getOwnPropertySymbols"),
        );
      } else {
        // Object.prototype.hasOwnProperty / Object.prototype.propertyIsEnumerable
        const propName = isObjectPrototypeMember(init);
        if (propName === "hasOwnProperty" || propName === "propertyIsEnumerable") {
          replacement = t.memberExpression(
            t.memberExpression(t.identifier("Object"), t.identifier("prototype")),
            t.identifier(propName),
          );
        }
      }

      if (replacement) {
        replaceBindingReferences(path, id.name, (refPath) => {
          refPath.replaceWith(t.cloneNode(replacement));
        });
      }
    },

    // Normalize computed member expressions: obj["prop"] -> obj.prop
    MemberExpression(path) {
      if (t.isStringLiteral(path.node.property)) {
        const val = path.node.property.value;
        if (isValidIdentifier(val)) {
          path.node.computed = false;
          path.node.property = t.identifier(val);
        }
      }
    },

    // Normalize computed methods/properties: ["method"]() -> method()
    ClassMethod(path) {
      normalizeComputedKey(path);
    },
    ObjectMethod(path) {
      normalizeComputedKey(path);
    },
    ClassProperty(path) {
      normalizeComputedKey(path);
    },
    ObjectProperty(path) {
      normalizeComputedKey(path);
    },
  });
}

function normalizeComputedKey(
  path: NodePath<t.ClassMethod | t.ObjectMethod | t.ClassProperty | t.ObjectProperty>,
): void {
  const { key, computed } = path.node;
  if (computed && t.isStringLiteral(key)) {
    const val = key.value;
    if (isValidIdentifier(val)) {
      path.node.computed = false;
      path.node.key = t.identifier(val);
    }
  }
}

/**
 * Pass: Clean Symbol polyfills
 * e.g., dn = (e, t) => (t = Symbol[e]) ? t : Symbol.for("Symbol." + e)
 */
function cleanSymbolPolyfills(ast: ParseResult<File>): void {
  console.log("Cleaning Symbol polyfills...");

  traverse(ast, {
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (!t.isIdentifier(id) || !init) return;

      // Arrow function with 2 params and conditional body
      if (!t.isArrowFunctionExpression(init)) return;
      if (init.params.length !== 2) return;
      if (!t.isConditionalExpression(init.body)) return;

      const { test } = init.body;
      if (!t.isAssignmentExpression(test)) return;
      if (!t.isMemberExpression(test.right)) return;
      if (!t.isIdentifier(test.right.object, { name: "Symbol" })) return;

      replaceBindingReferences(path, id.name, (refPath) => {
        const callPath = refPath.parentPath;
        if (
          callPath?.isCallExpression() &&
          callPath.node.callee === refPath.node &&
          callPath.node.arguments.length === 1
        ) {
          const arg = callPath.node.arguments[0];
          if (t.isStringLiteral(arg)) {
            callPath.replaceWith(
              t.memberExpression(t.identifier("Symbol"), t.identifier(arg.value)),
            );
          }
        }
      });
    },
  });
}

/**
 * Pass: Simplify defineProperty helpers
 * Pattern: (obj, key, val) => ... Object.defineProperty ...
 */
function simplifyDefinePropertyHelpers(path: NodePath<VariableDeclarator>): boolean {
  const { id, init } = path.node;

  if (!t.isIdentifier(id) || !t.isArrowFunctionExpression(init) || init.params.length !== 3)
    return false;
  if (!t.isConditionalExpression(init.body)) return false;

  const { consequent } = init.body;
  if (!t.isCallExpression(consequent)) return false;
  if (!t.isMemberExpression(consequent.callee)) return false;
  if (!t.isIdentifier(consequent.callee.object, { name: "Object" })) return false;
  if (!t.isIdentifier(consequent.callee.property, { name: "defineProperty" })) return false;

  return replaceBindingReferences(path, id.name, (refPath) => {
    const callPath = refPath.parentPath;
    if (
      callPath?.isCallExpression() &&
      callPath.node.callee === refPath.node &&
      callPath.node.arguments.length >= 3
    ) {
      callPath.replaceWith(createMemberAssignment(callPath.node.arguments));
    }
  });
}

/**
 * Pass: Simplify simple assignment helpers
 * Pattern: (a, b, c) => a[...b...] = c
 */
function simplifyAssignmentHelpers(path: NodePath<VariableDeclarator>): boolean {
  const { id, init } = path.node;

  if (!t.isIdentifier(id) || !t.isArrowFunctionExpression(init) || init.params.length !== 3)
    return false;
  if (!t.isAssignmentExpression(init.body) || init.body.operator !== "=") return false;

  return replaceBindingReferences(path, id.name, (refPath) => {
    const callPath = refPath.parentPath;
    if (
      callPath?.isCallExpression() &&
      callPath.node.callee === refPath.node &&
      callPath.node.arguments.length >= 2
    ) {
      callPath.replaceWith(createMemberAssignment(callPath.node.arguments));
    }
  });
}

/**
 * Pass: Replace Object.assign polyfills
 */
function replaceObjectAssignPolyfills(path: NodePath<VariableDeclarator>): boolean {
  const { id, init } = path.node;

  if (!t.isIdentifier(id) || !t.isArrowFunctionExpression(init) || init.params.length !== 2)
    return false;
  if (!t.isBlockStatement(init.body)) return false;
  if (!matchesAssignPolyfill(path.get("init") as NodePath)) return false;

  const result = replaceBindingReferences(path, id.name, (refPath) => {
    const callPath = refPath.parentPath;
    if (callPath?.isCallExpression() && callPath.node.callee === refPath.node) {
      callPath.replaceWith(
        t.callExpression(
          t.memberExpression(t.identifier("Object"), t.identifier("assign")),
          callPath.node.arguments,
        ),
      );
    }
  });

  if (result) {
    console.log(`Replaced Object.assign polyfill: ${id.name}`);
  }
  return result;
}

/**
 * Pass: Rename async iterator helpers
 */
function renameAsyncIteratorHelpers(path: NodePath<VariableDeclarator>): boolean {
  const { id, init } = path.node;

  if (!t.isIdentifier(id)) return false;
  if (!t.isArrowFunctionExpression(init) || init.params.length !== 3) return false;
  if (!t.isConditionalExpression(init.body)) return false;
  if (!hasAsyncIteratorUsage(path)) return false;

  console.log(`Renamed Async Iterator helper: ${id.name} -> getAsyncIterator`);
  path.scope.rename(id.name, "getAsyncIterator");
  return true;
}

/**
 * Pass: Simplify all helper functions
 */
function simplifyHelperFunctions(ast: ParseResult<File>): void {
  console.log("Simplifying helper functions...");

  traverse(ast, {
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (!t.isIdentifier(id) || !init) return;

      // Try each helper pattern in order
      if (simplifyDefinePropertyHelpers(path)) return;
      if (simplifyAssignmentHelpers(path)) return;
      if (replaceObjectAssignPolyfills(path)) return;
      renameAsyncIteratorHelpers(path);
    },
  });
}
