# GitOps manifests

ArgoCD watches this directory and reconciles the cluster against what
lives here. Anything you commit to `main` under `infra/gitops/` becomes
the desired cluster state within ~3 minutes.

## Bootstrap (one-time, after `tofu apply`)

```bash
# 1. Point kubectl at the cluster
eval "$(tofu -chdir=infra/tofu/environments/prod output -raw eks_kubeconfig_command)"

# 2. Wait for ArgoCD pods
kubectl -n argocd rollout status deploy/argocd-server

# 3. Apply the AppProject + root Application — ArgoCD takes over from here
kubectl apply -f infra/gitops/projects/resumaker.yaml
kubectl apply -f infra/gitops/root-app.yaml
```

After that, `apps/*.yaml`, `secrets/*.yaml`, and the Helm chart at
`infra/helm/resumaker/` are all reconciled automatically. CI bumps
`infra/helm/resumaker/values.prod.image.yaml` on each release and
ArgoCD picks it up.

## Layout

```
infra/gitops/
├── README.md                          this file
├── root-app.yaml                      app-of-apps: watches ./apps and ./secrets
├── projects/
│   └── resumaker.yaml                 AppProject (RBAC scope + allowed repos)
├── apps/
│   └── resumaker.yaml                 Application → infra/helm/resumaker
└── secrets/
    ├── cluster-secret-store.yaml      ClusterSecretStore → AWS Secrets Manager
    └── app-external-secret.yaml       ExternalSecret materializing app-secrets
```

## Adding a new app

1. Create a Helm chart under `infra/helm/<name>/`
2. Create `infra/gitops/apps/<name>.yaml` Application pointing to it
3. Commit — ArgoCD discovers + deploys it
