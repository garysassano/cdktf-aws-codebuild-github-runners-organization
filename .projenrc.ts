import { javascript } from "projen";
import { CdktfTypeScriptApp } from "projen-cdktf-app-ts";

const project = new CdktfTypeScriptApp({
  cdktfVersion: "0.20.8",
  defaultReleaseBranch: "main",
  depsUpgradeOptions: { workflow: false },
  devDeps: ["projen-cdktf-app-ts"],
  eslint: true,
  minNodeVersion: "20.15.0",
  name: "cdktf-aws-codebuild-github-runners",
  packageManager: javascript.NodePackageManager.PNPM,
  pnpmVersion: "9.5.0",
  prettier: true,
  projenrcTs: true,

  deps: ["yaml"],
  terraformProviders: [
    "hashicorp/aws@~> 5.59.0",
    "integrations/github@~> 6.2.3",
  ],
});

// Generate CDKTF constructs after installing deps
project.tasks.tryFind("install")?.spawn(project.cdktfTasks.get);

project.synth();
