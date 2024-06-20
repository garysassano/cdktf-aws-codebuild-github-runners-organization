import { Fn, TerraformStack } from "cdktf";
import { Construct } from "constructs";
import YAML from "yaml";
import { CodebuildProject } from "../../.gen/providers/aws/codebuild-project";
import { CodebuildSourceCredential } from "../../.gen/providers/aws/codebuild-source-credential";
import { CodebuildWebhook } from "../../.gen/providers/aws/codebuild-webhook";
import { DataAwsIamPolicyDocument } from "../../.gen/providers/aws/data-aws-iam-policy-document";
import { IamRole } from "../../.gen/providers/aws/iam-role";
import { AwsProvider } from "../../.gen/providers/aws/provider";
import { GithubProvider } from "../../.gen/providers/github/provider";
import { Repository } from "../../.gen/providers/github/repository";
import { RepositoryFile } from "../../.gen/providers/github/repository-file";

export class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Read GITHUB_TOKEN and GITHUB_OWNER from environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    if (!githubToken || !githubOwner) {
      throw new Error(
        "Required environment variables 'GITHUB_TOKEN' or 'GITHUB_OWNER' are missing or undefined",
      );
    }

    // Configure providers
    new AwsProvider(this, "AwsProvider");
    new GithubProvider(this, "GithubProvider");

    // Add CodeBuild credentials for GitHub source provider
    new CodebuildSourceCredential(this, "GitHubSourceCredential", {
      authType: "PERSONAL_ACCESS_TOKEN",
      serverType: "GITHUB",
      token: githubToken,
    });

    // Create GitHub repository
    const sampleRepo = new Repository(this, "SampleRepo", {
      name: "sample-repo",
      autoInit: true,
    });

    /*
     * IAM POLICIES
     */

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
          actions: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: ["*"],
        },
      ],
    });

    /*
     * IAM ROLES
     */

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

    /*
     * CODEBUILD
     */

    // Create CodeBuild project
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

    // Create CodeBuild webhook for GitHub repository
    new CodebuildWebhook(this, "CodebuildWebhook", {
      projectName: sampleProject.name,
      scopeConfiguration: {
        scope: "GITHUB_ORGANIZATION",
        name: githubOwner,
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

    /*
     * GITHUB
     */

    // GHA workflow in Object format
    const ghaWorkflowObject = {
      name: "Hello World",
      on: {
        workflow_dispatch: {},
      },
      jobs: {
        hello_world: {
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
  }
}
