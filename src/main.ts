import { App } from "cdktn";
import { MyStack } from "./stacks/my-stack.js";

const app = new App();

new MyStack(app, "cdktn-aws-codebuild-gha-runners-org-dev");

app.synth();
