variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "il-central-1"
}

variable "project" {
  description = "Project identifier"
  type        = string
  default     = "resumaker"
}

# ─── EKS API endpoint lockdown ───────────────────────────────────────
# Default 0.0.0.0/0 is only safe for the initial bootstrap. After ArgoCD
# is up, restrict this to your VPN/office CIDR (e.g. ["1.2.3.4/32"]).

variable "eks_public_access_cidrs" {
  description = "CIDRs allowed to reach the EKS public API endpoint. 0.0.0.0/0 is bootstrap-only — restrict before launch."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ─── ArgoCD ingress ──────────────────────────────────────────────────
# Fill these in after Cloudflare/Route53 + ACM cert are ready.
# Until then, ArgoCD comes up but the ingress will fail health checks.

variable "argocd_domain" {
  description = "Hostname ArgoCD will be reachable at (e.g. argocd.resumaker.co.il)"
  type        = string
  default     = "argocd.resumaker.co.il"
}

variable "argocd_acm_cert_arn" {
  description = "ACM cert ARN for the ArgoCD ALB. Issue in il-central-1 via ACM, then paste here."
  type        = string
  default     = ""
}
