import { VariableMap } from "../nodes/node"

const TEMPLATE_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g

export class TemplateEngine {
  render(template: string, variables: VariableMap): string {
    return template.replace(TEMPLATE_REGEX, (_, expression) => {
      const value = this.resolve(expression, variables)

      return value == null ? "" : String(value)
    })
  }

  private resolve(path: string, variables: VariableMap): unknown {
    return path
      .trim()
      .split(".")
      .reduce<unknown>((current, key) => {
        if (
          current == null ||
          typeof current !== "object" ||
          !(key in current)
        ) {
          return undefined
        }

        return (current as Record<string, unknown>)[key]
      }, variables)
  }
}
