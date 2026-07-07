import { VariableMap } from "@linea/shared/contracts"

const TEMPLATE_REGEX = /\{\{\s*([^}]+?)\s*\}\}/g

export class TemplateEngine {
  render(template: string, variables: VariableMap): string {
    return template.replace(TEMPLATE_REGEX, (_, expression) => {
      const value = this.resolve(expression, variables)

      return value == null ? "" : String(value)
    })
  }

  renderWorkflow<T>(workflow: T, variables: VariableMap): T {
    return this.renderValue(workflow, variables)
  }

  private renderValue<T>(value: T, variables: VariableMap): T {
    if (typeof value === "string") {
      return this.render(value, variables) as T
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.renderValue(item, variables)) as T
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, val]) => [
          key,
          this.renderValue(val, variables),
        ])
      ) as T
    }

    return value
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
