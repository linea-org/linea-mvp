import { defineDocs, defineConfig } from 'fumadocs-mdx/config';

// Converts ```mermaid fences into <Mermaid chart="..." /> JSX nodes BEFORE
// rehype-pretty-code runs, so Shiki never tries to tokenize mermaid syntax.
function remarkMermaid() {
  return (tree: any) => {
    function walk(node: any) {
      if (!node.children) return;
      node.children = node.children.flatMap((child: any) => {
        walk(child);
        if (child.type === 'code' && child.lang === 'mermaid') {
          return [
            {
              type: 'mdxJsxFlowElement',
              name: 'Mermaid',
              attributes: [
                { type: 'mdxJsxAttribute', name: 'chart', value: child.value },
              ],
              children: [],
            },
          ];
        }
        return [child];
      });
    }
    walk(tree);
  };
}

export const docs = defineDocs({
  dir: 'content/docs',
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMermaid],
  },
});
