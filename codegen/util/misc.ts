export function toPascalCase(str: string) {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

export function toSnakeCase(str: string) {
  return str
    .split(/[^a-zA-Z0-9]+/)
    .map(word => word.toLowerCase())
    .join('_');
}

export function toCamelCase(str: string) {
  const pascalCase = toPascalCase(str);
  return lowerCaseFirst(pascalCase);
}

export function upperCaseFirst(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function lowerCaseFirst(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function identifierToNamespace(identifier: string) {
  return identifier.split(":")[0];
}

export function identifierToPath(identifier: string) {
  if (!identifier.includes(":")) {
    return identifier;
  }

  const [_, path] = identifier.startsWith("#") ? identifier.slice(1).split(":") : identifier.split(":");
  return path;
}

export function registryNameToEnumName(registryName: string) {
  switch (registryName) {
    case "block_type":
      registryName = "abstract_" + registryName;
      break;
    case "menu":
    case "block":
    case "item":
      registryName += "_type";
      break;
    default:
      break;
  }

  return toPascalCase(registryName);
}