# cdktn-aws-codebuild-gha-runners-org

CDKTN app  that deploys a GitHub repository within an organization, along with an organization webhook that triggers [CodeBuild-hosted GitHub Actions runners](https://docs.aws.amazon.com/codebuild/latest/userguide/action-runner.html) when workflow jobs are queued.

### Related Apps

- [cdktn-aws-codebuild-gha-runners](https://github.com/garysassano/cdktn-aws-codebuild-gha-runners) - Uses a GitHub repository webhook instead of organization webhook.
- [cdk-aws-codebuild-gha-runners](https://github.com/garysassano/cdk-aws-codebuild-gha-runners) - Uses a GitHub repository webhook instead of organization webhook; built with AWS CDK instead of CDKTF.

## Prerequisites

- **_AWS:_**
  - Must have authenticated with [Default Credentials](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication-and-configuration) in your local environment.
- **_GitHub:_**
  - Must have set the `GITHUB_TOKEN` variable in your local environment, with the `repo`, `workflow`, and `admin:org_hook` scopes.
  - Must have set the `GITHUB_OWNER` variable to a GitHub organization you administer.
- **_mise:_**
  - [Install mise](https://mise.jdx.dev/installing-mise.html), which manages Node, pnpm, and OpenTofu.

## Installation

```sh
mise install
pnpm install
pnpm gen
```

`pnpm gen` generates the AWS and GitHub provider constructs into `.gen/`. Re-run it whenever a provider constraint in `cdktf.json` changes.

## Deployment

```sh
pnpm deploy
```

## Usage

1. Access the GitHub Actions workflow by clicking the `<GHA_WORKFLOW_URL>` from the deployment outputs:

   ```sh
   Outputs:
   GhaWorkflowUrl = <GHA_WORKFLOW_URL>
   ```

2. Click `Run workflow` ➜ `Run workflow`.

3. Your workflow will be enqueued and run on an ephemeral EC2 instance managed by AWS CodeBuild.

## Cleanup

```sh
pnpm destroy
```

## Architecture Diagram

![Architecture Diagram](./src/assets/arch-diagram.svg)
