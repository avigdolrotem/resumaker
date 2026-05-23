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
  description = "CIDRs allowed to reach the EKS public API endpoint. MUST be set explicitly to prevent accidental world-readable cluster. Use [\"0.0.0.0/0\"] only for the initial bootstrap, then restrict to your VPN/office IP."
  type        = list(string)
  # No default — force the caller to make the decision. Bootstrap with
  # `tofu apply -var='eks_public_access_cidrs=["0.0.0.0/0"]'`, then
  # set `eks_public_access_cidrs = ["YOUR_IP/32"]` in a tfvars file.
}

variable "argocd_acm_cert_arn" {
  description = "ACM certificate ARN for argocd.resumaker.co.il. Must be issued in il-central-1. Required — empty string would fail ALB listener creation."
  type        = string
  # No default — empty string would silently break the ALB ingress.
  validation {
    condition     = length(var.argocd_acm_cert_arn) > 20
    error_message = "argocd_acm_cert_arn must be a real ACM ARN, not an empty placeholder."
  }
}

# ─── ArgoCD ingress ──────────────────────────────────────────────────

variable "argocd_domain" {
  description = "Hostname ArgoCD will be reachable at (e.g. argocd.resumaker.co.il)"
  type        = string
  default     = "argocd.resumaker.co.il"
}
