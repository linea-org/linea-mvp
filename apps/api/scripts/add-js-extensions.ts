import { Project } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

// If you have multiple tsconfigs in a monorepo:
// project.addSourceFilesFromTsConfig("apps/api/tsconfig.json");
// project.addSourceFilesFromTsConfig("packages/db/tsconfig.json");

for (const sourceFile of project.getSourceFiles()) {
  let changed = false;

  // imports
  for (const decl of sourceFile.getImportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();

    if (
      decl.isModuleSpecifierRelative() &&
      !/\.(js|mjs|cjs|json)$/i.test(spec)
    ) {
      decl.setModuleSpecifier(spec + '.js');
      changed = true;
    }
  }

  // export ... from
  for (const decl of sourceFile.getExportDeclarations()) {
    const spec = decl.getModuleSpecifierValue();
    if (!spec) continue;

    if (
      (spec.startsWith('./') || spec.startsWith('../')) &&
      !/\.(js|mjs|cjs|json)$/i.test(spec)
    ) {
      decl.setModuleSpecifier(spec + '.js');
      changed = true;
    }
  }

  if (changed) {
    console.log(sourceFile.getFilePath());
  }
}

await project.save();

console.log('Done.');
