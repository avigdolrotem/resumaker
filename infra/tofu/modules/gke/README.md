# GKE Autopilot module

Provisions a GKE Autopilot cluster wired to the network module. Workload Identity is enabled; the cluster trusts pods that match `{project}.svc.id.goog`.

## Why Autopilot

- Per-pod billing (no idle node cost beyond control plane).
- Google manages the node pool, autoscaling, OS patching, security.
- Sane defaults for solo-dev scale.

## Constraints

- No privileged pods, no host networking, no custom node images.
- Resource requests must fit Autopilot's compute classes.

## After apply

```bash
gcloud container clusters get-credentials resumaker-dev \
  --region=europe-west1 \
  --project=resumaker-dev
kubectl get nodes
```
