import * as acorn from "acorn";
import { tsPlugin } from "acorn-typescript";

/**
 * Converts a typescript keyword to a JSON schema type
 * @param value The typescript keyword
 */
function jsonSchemaTypeFromKeyword(value: string): string | undefined {
    const match = value.match(/^TS(.*)Keyword$/);
    return match ? match[1].toLowerCase() : undefined;
  }

/**
 * Generates a JSON schema for function parameters
 * @param node The AST node for the function
 * @param paramDescriptions The descriptions for each parameter
 */
function generateJsonSchema(node: any, paramDescriptions: any): any {
    const schema: any = { properties: {}, required: [] };

    function getType(typeNode: any): any {
        if (typeNode.type === 'TSArrayType') {
            return getType(typeNode.elementType) + '[]';
        } else {
            return jsonSchemaTypeFromKeyword(typeNode.type);
        }
    }

    node.params.forEach((param: any) => {
        let type = param.typeAnnotation ? getType(param.typeAnnotation.typeAnnotation) : 'any';
        schema.properties[param.name] = { type, description: paramDescriptions[param.name] };
        if (!param.optional) {
            schema.required.push(param.name);
        }
    });
    return schema;
}

/**
 * Parses a JSDoc comment and returns the function description and parameter descriptions
 * @param jsdoc The JSDoc comment to parse
 */
function parseJSDoc(jsdoc: string): { funcDescription: string, params: { [key: string]: string } } {
    const funcDescriptionMatch = jsdoc.match(/(?<=\*\s)(.*)/);
    const paramsMatch = jsdoc.match(/@param\s(\w+)\s(.*)/g);

    let funcDescription = '';
    if (funcDescriptionMatch) {
        funcDescription = funcDescriptionMatch[0].trim();
    }

    let params: { [key: string]: string } = {};
    if (paramsMatch) {
        paramsMatch.forEach(param => {
            const splitParam = param.split(' ');
            params[splitParam[1]] = splitParam.slice(2).join(' ');
        });
    }

    return { funcDescription, params };
}

/**
 * Parses a typescript file and returns a JSON schema for each function
 * @param code The typescript code to parse
 * @returns A JSON schema for each function
 */
export function parseTypescript(code: string) {
    const ast = acorn.Parser.extend(tsPlugin() as any).parse(code, {
        sourceType: "module",
        ecmaVersion: "latest",
    });

    function walk(anode: acorn.Node, callback: any, depth = 0) {
        const done = callback(anode, depth);
        if (done) {
            return;
        }
        const node = anode as any;
        for (const key in node) {
            if (node[key] && typeof node[key] === "object") {
                walk(node[key], callback, depth + 1);
            }
        }
    }
    let lastLocEnd: any = undefined

    walk(ast, (node: acorn.Node, depth: number) => {
        const spaces = " ".repeat(depth);
        switch (node.type) {
            case "FunctionDeclaration":
                let description = undefined
                let paramDescriptions = {}
                if (node.loc && lastLocEnd) {
                    let start = node.loc.start
                    // print code between lastLocEnd and start
                    let jsdoc = code.substring(lastLocEnd.index, start.index)
                    let parsedJSDoc = parseJSDoc(jsdoc)
                    // console.log(jsdoc)
                    // console.log((jsdoc))
                    description = parsedJSDoc.funcDescription
                    paramDescriptions = parsedJSDoc.params
                }
                //   console.log(spaces + "FunctionDeclaration", node);
                console.log(`${spaces}Function: ${node.id.name}`);
                let func = {
                    functionName: node.id.name,
                    description: description,
                    params: generateJsonSchema(node, paramDescriptions)
                }
                console.log(`${JSON.stringify(func, null, 2)}`);
                // process.exit(0)
                return true
            default:
                if (node.loc && node.loc.end)
                    lastLocEnd = node.loc.end
                // console.log(spaces, JSON.stringify([node.type, node.loc]));
        }
    });
}