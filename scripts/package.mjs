#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const args = { format: "zip" };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--format" || arg === "-f") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("缺少 --format 参数值，可选 zip 或 tar");
      }
      args.format = value;
      i += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`不支持的参数: ${arg}`);
  }

  return args;
}

function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} 执行失败，退出码: ${result.status}`);
  }
}

function copyEntryWithoutJunk(src, dest) {
  const base = path.basename(src);
  if (base === ".DS_Store") {
    return;
  }

  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    const children = readdirSync(src);
    for (const child of children) {
      copyEntryWithoutJunk(path.join(src, child), path.join(dest, child));
    }
    return;
  }

  cpSync(src, dest);
}

function main() {
  const { format, help } = parseArgs(process.argv);

  if (help) {
    console.log("用法: node scripts/package.mjs --format <zip|tar>");
    process.exit(0);
  }

  if (!["zip", "tar"].includes(format)) {
    throw new Error(`--format 仅支持 zip 或 tar，收到: ${format}`);
  }

  const root = process.cwd();
  const outputDir = path.join(root, "target");
  const tempDir = path.join(outputDir, ".package-temp");
  const manifestPath = path.join(root, "manifest.json");

  if (!existsSync(manifestPath)) {
    throw new Error("找不到 manifest.json，请在项目根目录执行");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const pluginId = manifest.id ?? "plugin";
  const version = manifest.version ?? "0.0.0";
  const bundleDirName = `${pluginId}-${version}`;
  const bundleDir = path.join(tempDir, bundleDirName);
  const outputName =
    format === "zip" ? `${bundleDirName}.zip` : `${bundleDirName}.tar.gz`;
  const outputPath = path.join(outputDir, outputName);

  const packageEntries = ["main.js", "manifest.json", "versions.json", "img"];

  const missing = packageEntries.filter((entry) => !existsSync(path.join(root, entry)));
  if (missing.length > 0) {
    throw new Error(`打包失败，缺少必要文件/目录: ${missing.join(", ")}`);
  }

  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(bundleDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  for (const entry of packageEntries) {
    copyEntryWithoutJunk(path.join(root, entry), path.join(bundleDir, entry));
  }

  rmSync(outputPath, { force: true });

  if (format === "zip") {
    run("zip", ["-r", outputPath, bundleDirName], tempDir);
  } else {
    run("tar", ["-czf", outputPath, bundleDirName], tempDir);
  }

  rmSync(tempDir, { recursive: true, force: true });

  console.log(`打包完成: ${outputPath}`);
}

main();
