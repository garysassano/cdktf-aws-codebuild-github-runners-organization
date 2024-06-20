import { Fn, TerraformOutput, TerraformStack } from "cdktn";
import type { Construct } from "constructs";
import YAML from "yaml";
import { CodebuildProject } from "../../.gen/providers/aws/codebuild-project/index.js";
import { CodebuildSourceCredential } from "../../.gen/providers/aws/codebuild-source-credential/index.js";
import { CodebuildWebhook } from "../../.gen/providers/aws/codebuild-webhook/index.js";
import { DataAwsIamPolicyDocument } from "../../.gen/providers/aws/data-aws-iam-policy-document/index.js";
import { IamRole } from "../../.gen/providers/aws/iam-role/index.js";
import { AwsProvider } from "../../.gen/providers/aws/provider/index.js";
import { GithubProvider } from "../../.gen/providers/github/provider/index.js";
import { Repository } from "../../.gen/providers/github/repository/index.js";
import { RepositoryFile } from "../../.gen/providers/github/repository-file/index.js";
import { validateEnv } from "../utils/validate-env.js";

const env = validateEnv(["GITHUB_TOKEN", "GITHUB_OWNER"]);

export class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    //==============================================================================
    // PROVIDERS
    //==============================================================================

    new AwsProvider(this, "AwsProvider");
    new GithubProvider(this, "GithubProvider");

    //==============================================================================
    // GITHUB
    //==============================================================================

    const sampleRepo = new Repository(this, "SampleRepo", {
      name: "sample-repo",
      autoInit: true,
    });

    //==============================================================================
    // IAM POLICIES
    //==============================================================================

    const codebuildAssumeRolePolicy = new DataAwsIamPolicyDocument(
      this,
      "CodebuildAssumeRolePolicy",
      {
        statement: [
          {
            effect: "Allow",
            actions: ["sts:AssumeRole"],
            principals: [
              {
                type: "Service",
                identifiers: ["codebuild.amazonaws.com"],
              },
            ],
          },
        ],
      },
    );

    const cwLogsPolicy = new DataAwsIamPolicyDocument(this, "CWLogsPolicy", {
      statement: [
        {
          effect: "Allow",
          actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
          resources: ["*"],
        },
      ],
    });

    //==============================================================================
    // IAM ROLES
    //==============================================================================

    const codebuildProjectRole = new IamRole(this, "CodebuildProjectRole", {
      name: "codebuild-project-role",
      assumeRolePolicy: codebuildAssumeRolePolicy.json,
      inlinePolicy: [
        {
          name: "cw-logs-policy",
          policy: cwLogsPolicy.json,
        },
      ],
    });

    //==============================================================================
    // CODEBUILD
    //==============================================================================

    const githubSourceCredential = new CodebuildSourceCredential(this, "GithubSourceCredential", {
      authType: "PERSONAL_ACCESS_TOKEN",
      serverType: "GITHUB",
      token: env.GITHUB_TOKEN,
    });

    const sampleProject = new CodebuildProject(this, "SampleProject", {
      name: "sample-project",
      serviceRole: codebuildProjectRole.arn,
      source: {
        type: "GITHUB",
        location: "CODEBUILD_DEFAULT_WEBHOOK_SOURCE_LOCATION",
      },
      environment: {
        type: "LINUX_CONTAINER",
        computeType: "BUILD_GENERAL1_SMALL",
        image: "aws/codebuild/standard:7.0",
      },
      artifacts: {
        type: "NO_ARTIFACTS",
      },
    });

    new CodebuildWebhook(this, "CodebuildWebhook", {
      // Webhook must be destroyed before the credential CodeBuild uses to delete it
      dependsOn: [githubSourceCredential],
      projectName: sampleProject.name,
      scopeConfiguration: {
        scope: "GITHUB_ORGANIZATION",
        name: env.GITHUB_OWNER,
      },
      filterGroup: [
        {
          filter: [
            {
              type: "EVENT",
              pattern: "WORKFLOW_JOB_QUEUED",
            },
          ],
        },
      ],
    });

    //==============================================================================
    // GHA WORKFLOWS
    //==============================================================================

    // GHA workflow in Object format
    const ghaWorkflowObject = {
      name: "Hello World",
      on: {
        workflow_dispatch: {},
      },
      jobs: {
        hello_world: {
          // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression, kept literal by Fn.rawString
          "runs-on": `codebuild-${sampleProject.name}-${Fn.rawString("${{ github.run_id }}-${{ github.run_attempt }}")}`,
          steps: [
            {
              run: 'echo "Hello World!"',
            },
          ],
        },
      },
    };

    // Add GHA workflow file to repository
    new RepositoryFile(this, "GhaWorkflowFile", {
      repository: sampleRepo.name,
      file: Fn.rawString(".github/workflows/hello-world.yml"),
      content: YAML.stringify(ghaWorkflowObject),
      commitMessage: "Add GHA workflow file",
    });

    //==============================================================================
    // OUTPUTS
    //==============================================================================

    new TerraformOutput(this, "GhaWorkflowUrl", {
      value: `https://github.com/${sampleRepo.fullName}/actions/workflows/hello-world.yml`,
      description: "URL to the GitHub Actions workflow",
    });
  }
}
