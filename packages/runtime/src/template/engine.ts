import { VariableMap } from "@linea/shared/contracts"

const TEMPLATE_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g

export class TemplateEngine {
  render(template: string, context: VariableMap): string {
    return template.replace(TEMPLATE_REGEX, (_, expression) => {
      const value = this.resolve(expression, context)

      return value == null ? `{{${expression}}}` : String(value)
    })
  }

  renderObject<T>(value: T, context: VariableMap): T {
    if (typeof value === "string") {
      return this.render(value, context) as T
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.renderObject(item, context)) as T
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [
          key,
          this.renderObject(val, context),
        ])
      ) as T
    }

    return value
  }

  private resolve(path: string, context: VariableMap): unknown {
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
      }, context)
  }
}
