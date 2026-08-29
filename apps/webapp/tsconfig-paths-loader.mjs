import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createRequire } from "module";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = resolve(__dirname, "../..");
const packagesDir = resolve(rootDir, "packages");
const require = createRequire(import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  // 处理 ~ 路径别名
  if (specifier.startsWith("~/")) {
    const subPath = specifier.slice(2);
    const extensions = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx", "/index.js"];
    
    for (const ext of extensions) {
      try {
        return await nextResolve(
          pathToFileURL(resolve(__dirname, "app", subPath + ext)).href,
          context
        );
      } catch {}
    }
    throw new Error(`Cannot resolve ~/${subPath}`);
  }
  
  // 处理 @core/* 包
  if (specifier.startsWith("@core/")) {
    const pkgName = specifier.replace("@core/", "");
    const pkgDir = resolve(packagesDir, pkgName);
    
    try {
      // 使用 require 解析到 dist/index.js
      const pkg = require(resolve(pkgDir, "package.json"));
      const main = resolve(pkgDir, pkg.main || "./dist/index.js");
      return await nextResolve(pathToFileURL(main).href, context);
    } catch {
      // 如果包不存在，继续默认解析
    }
  }
  
  return nextResolve(specifier, context);
}
