import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Mermaid } from '@/components/mermaid';

export function useMDXComponents(components: Record<string, unknown>) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    ...components,
  };
}
