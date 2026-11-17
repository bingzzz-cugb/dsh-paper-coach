function assertDshValueNode(node: any, path: string): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error(`unsupported JSON schema: ${path} must be a value schema object`)
  }
  if (node.type === 'object') {
    if (typeof node.additionalProperties !== 'boolean') {
      throw new Error(`unsupported JSON schema: ${path}.additionalProperties must be explicitly true or false`)
    }
    if (node.properties !== undefined) {
      assertDshPropertyMap(node.properties, `${path}.properties`)
    }
  } else if (node.type === 'array' && node.items !== undefined) {
    assertDshValueNode(node.items, `${path}.items`)
  }
}

function assertDshPropertyMap(map: any, path: string): void {
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new Error(`unsupported JSON schema: ${path} must be an object of value schemas`)
  }
  for (const [k, v] of Object.entries(map)) {
    assertDshValueNode(v, `${path}.${k}`)
  }
}

export function defineTool<T extends Record<string, any>>(options: T): T {
  assertDshPropertyMap(options.parameters ?? {}, 'parameters')
  if (!options.output?.schema) {
    throw new Error(`tool "${options.name}" must declare output.schema`)
  }
  assertDshValueNode(options.output.schema, 'schema')
  return options
}
