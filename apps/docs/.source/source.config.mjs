// source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";
function remarkMermaid() {
  return (tree) => {
    function walk(node) {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        walk(child);
        if (child.type === "code" && child.lang === "mermaid") {
          return [
            {
              type: "mdxJsxFlowElement",
              name: "Mermaid",
              attributes: [
                { type: "mdxJsxAttribute", name: "chart", value: child.value }
              ],
              children: []
            }
          ];
        }
        return [child];
      });
    }
    walk(tree);
  };
}
var docs = defineDocs({
  dir: "content/docs"
});
var source_config_default = defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMermaid]
  }
});
export {
  source_config_default as default,
  docs
};
