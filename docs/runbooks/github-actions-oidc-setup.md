# GitHub Actions OIDC role setup

One-shot AWS configuration so the `deploy.yml` workflow can push
container images to ECR without long-lived AWS credentials in GitHub.

## Why OIDC

GitHub Actions can mint short-lived AWS credentials via OpenID Connect.
The alternative — storing an `AWS_ACCESS_KEY_ID` as a repo secret —
means a leaked secret has no automatic expiry and grants persistent
access to your account. With OIDC, the trust policy locks credentials
to a specific repo + ref pattern, and tokens expire in 1 hour.

## What this creates

1. An OIDC identity provider in IAM trusting `token.actions.githubusercontent.com`
2. An IAM role `resumaker-github-deploy` assumable only by
   `avigdolrotem/resumaker` on tag pushes matching `v*`
3. A policy attached to that role with the minimum permissions
   `deploy.yml` needs (ECR push)

## Prerequisites

```bash
aws sts get-caller-identity --profile resumaker
# Expect: Account 857812839967
```

## Step 1 — Create the OIDC identity provider

(Skip if you've done this for another repo in the same account.)

```bash
aws iam create-open-id-connect-provider \
  --profile resumaker \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

If the thumbprint check fails (AWS rotates these), grab the current
one with:

```bash
openssl s_client -servername token.actions.githubusercontent.com \
  -showcerts -connect token.actions.githubusercontent.com:443 \
  </dev/null 2>/dev/null \
  | openssl x509 -fingerprint -noout -sha1 \
  | tr -d ':' | tr 'A-F' 'a-f' | cut -d= -f2
```

## Step 2 — Create the trust policy

Save as `/tmp/github-trust.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::857812839967:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:avigdolrotem/resumaker:ref:refs/tags/v*",
            "repo:avigdolrotem/resumaker:environment:prod"
          ]
        }
      }
    }
  ]
}
```

The `StringLike` block is the security boundary — only tag pushes
starting with `v` (`v0.1.0`, `v1.2.3`) and the `prod` environment can
assume this role. Pull requests can NOT.

## Step 3 — Create the role

```bash
aws iam create-role \
  --profile resumaker \
  --role-name resumaker-github-deploy \
  --assume-role-policy-document file:///tmp/github-trust.json \
  --description "Assumed by GitHub Actions to push images to ECR" \
  --max-session-duration 3600
```

## Step 4 — Create the inline permissions policy

Save as `/tmp/github-deploy-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRLogin",
      "Effect": "Allow",
      "Action": "ecr:GetAuthorizationToken",
      "Resource": "*"
    },
    {
      "Sid": "ECRPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:BatchGetImage",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeImages",
        "ecr:DescribeRepositories",
        "ecr:GetDownloadUrlForLayer",
        "ecr:InitiateLayerUpload",
        "ecr:ListImages",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "arn:aws:ecr:il-central-1:857812839967:repository/resumaker-prod/*"
    }
  ]
}
```

Attach it:

```bash
aws iam put-role-policy \
  --profile resumaker \
  --role-name resumaker-github-deploy \
  --policy-name resumaker-deploy-permissions \
  --policy-document file:///tmp/github-deploy-policy.json
```

## Step 5 — Grab the role ARN

```bash
aws iam get-role \
  --profile resumaker \
  --role-name resumaker-github-deploy \
  --query 'Role.Arn' --output text
```

Output: `arn:aws:iam::857812839967:role/resumaker-github-deploy`

## Step 6 — Set GitHub Actions secrets

GitHub → repo Settings → Secrets and variables → Actions → New repository secret:

| Secret name              | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN`    | `arn:aws:iam::857812839967:role/resumaker-github-deploy` |
| `AWS_ACCOUNT_ID`         | `857812839967`                                           |
| `AWS_REGION`             | `il-central-1`                                           |
| `NEXT_PUBLIC_SENTRY_DSN` | the Sentry DSN (public-by-design, fine in CI)            |

`gh` CLI alternative:

```bash
cd /Volumes/Server_Data/code-server/workspace/resumaker
gh secret set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::857812839967:role/resumaker-github-deploy"
gh secret set AWS_ACCOUNT_ID --body "857812839967"
gh secret set AWS_REGION --body "il-central-1"
gh secret set NEXT_PUBLIC_SENTRY_DSN --body "https://dd977be424b5b1ab8ee3ebeccd7cb20e@o4511444222869504.ingest.de.sentry.io/4511444224573521"
```

## Step 7 — Test

Once `tofu apply` has run and the ECR repo exists:

```bash
git tag v0.1.0-test
git push --tags
```

Watch the Actions tab. The `build-and-push` job should:

1. Assume the role via OIDC (visible in job logs as "Configuring AWS credentials")
2. Login to ECR
3. Build + push the multi-arch image

If it fails on assume-role, double-check the `StringLike` subject in
the trust policy — it MUST match `refs/tags/v*` exactly.

## Cleanup (only if you want to delete this setup)

```bash
aws iam delete-role-policy --profile resumaker \
  --role-name resumaker-github-deploy \
  --policy-name resumaker-deploy-permissions
aws iam delete-role --profile resumaker --role-name resumaker-github-deploy
# DO NOT delete the OIDC provider if other repos use it.
```
