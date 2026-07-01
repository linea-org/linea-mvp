export interface Prerequisite {
  type: string;
  label: string;
  description: string;
}

export interface TemplateDefinition {
  name: string;
  description: string;
  category: string;
  featured: boolean;
  prerequisites?: Prerequisite[];
  definition: object;
}
