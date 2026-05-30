# Migration + Post-Migration Handoff (2026-05-30)

This is the single reference for moving Resumaker dev off the Mac to a new
machine (native **Ubuntu** — recommended — or **Windows/WSL2**), reducing GCP
cost, and picking the project back up cleanly. It has three parts:

1. **Setup script** — run on the new box to install every tool.
2. **GCP cost-reduction plan** — the run-rate is ~$10–13/day idle; how to cut it.
3. **Handoff prompt** — paste into a fresh Claude Code session after setup.

## Choosing the OS

- **Native Ubuntu (recommended): 24.04 LTS "Noble"** (supported to 2029; 22.04
  also fine). Simplest path — it's Linux already, closest to prod (GKE), and Docker
  runs without a VM, so the local builds that OOM'd the 16GB Mac may work locally
  again. Clone anywhere on the native FS (`~/code/resumaker`).
- **Windows: use WSL2 (Ubuntu 24.04), not native PowerShell.** This repo is bash +
  pre-commit + docker + gcloud + helm + tofu — seamless in WSL2, painful natively.
  Clone into the WSL2 home FS (`~/code/...`), **never** `/mnt/c/...` (10× slower for
  node_modules).

The bootstrap script below is the same on both. The only differences:

|                 | Native Ubuntu 24.04                                                       | Windows/WSL2                                                |
| --------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| OS prep         | none                                                                      | `wsl --install -d Ubuntu-24.04` (PowerShell admin) + reboot |
| Docker          | `sudo apt install docker.io` + `sudo usermod -aG docker $USER` (re-login) | Docker Desktop + enable WSL Integration                     |
| pre-commit      | `pipx` (PEP 668 blocks `pip --user` on 24.04) — handled in the script     | same                                                        |
| `/mnt/c` gotcha | n/a                                                                       | avoid it; use `~/`                                          |

---

## Part 0 — Transfer the data from the Mac (same LAN, keep both machines)

You own both boxes and they're on the same LAN, so use **rsync over SSH** — encrypted,
resumable, and it carries the files that are NOT in git (your `.env`s, agent DBs) which
a fresh clone would miss. `.git` is portable, so this also brings the full repo (no
separate `git clone` needed).

**What transfers vs not:**

- TRANSFER: `.git` + all source + the 3 `.env` files + `.claude/*.local` + RuVector
  `*.rvf` / `ruvector.db`.
- EXCLUDE (Mac-specific or rebuildable — regenerate on Ubuntu): `node_modules` (arm64
  binaries), `.next` (build cache), `infra/tofu/**/.terraform/` (darwin_arm64 provider
  binaries — would break on Linux; re-fetched by `tofu init`).

```bash
# --- On the Ubuntu PC (target): enable SSH + make the destination ---
sudo apt update && sudo apt install -y openssh-server rsync
sudo systemctl enable --now ssh
hostname -I            # note the LAN IP, e.g. 192.168.1.42
mkdir -p ~/code/resumaker

# --- On the Mac (source): push the repo (excludes the rebuildable/arm64 dirs) ---
rsync -avhP \
  --exclude='node_modules' --exclude='**/node_modules' \
  --exclude='.next' --exclude='**/.next' \
  --exclude='.terraform' --exclude='**/.terraform' \
  --exclude='.turbo' --exclude='coverage' \
  /Volumes/Server_Data/code-server/workspace/resumaker/ \
  UBUNTU_USER@UBUNTU_IP:/home/UBUNTU_USER/code/resumaker/

# --- On the Mac: push Claude config + memory (plugins, settings, this project's memory) ---
rsync -avhP ~/.claude/ UBUNTU_USER@UBUNTU_IP:/home/UBUNTU_USER/.claude/
```

```bash
# --- On the Ubuntu PC (after transfer): rebuild + fix the memory path ---
cd ~/code/resumaker
pnpm install --frozen-lockfile        # rebuilds node_modules for linux-x64
pre-commit install
chmod 600 .env apps/web/.env apps/web/.env.local

# Re-fetch tofu providers for linux (only if you run tofu locally):
for e in prod staging dev; do tofu -chdir=infra/tofu/environments/$e init -backend=false || true; done

# Remap Claude project memory to the new path-encoded dir name.
# Foolproof: open `claude` once in ~/code/resumaker (it creates the correct dir), exit, then:
cd ~/.claude/projects
cp -a "./-Volumes-Server-Data-code-server-workspace-resumaker/memory/." \
      "./-home-$USER-code-resumaker/memory/"   # dir name = abs repo path, '/'→'-', leading '/'→leading '-'
```

**Verify the transfer was lossless (run on BOTH, compare):**

```bash
# secrets intact?  Mac: shasum -a256 ...   Ubuntu: sha256sum ...
( cd ~/code/resumaker && sha256sum .env apps/web/.env apps/web/.env.local )
# repo intact?
git -C ~/code/resumaker fsck && git -C ~/code/resumaker status -s && git -C ~/code/resumaker log --oneline -1
```

The two checksum sets must match across machines, `git status` must be clean, and the
`git log` HEAD must equal `origin/main`. Your Mac is untouched throughout (rsync only
reads it), so nothing is at risk — re-run the rsync anytime to catch later changes.

---

## Part 1 — Setup script (native Ubuntu or WSL2)

**Windows only, first:** in PowerShell (admin) run `wsl --install -d Ubuntu-24.04`,
reboot, open Ubuntu, create your user; install Docker Desktop and enable _Settings →
Resources → WSL Integration → Ubuntu-24.04_. **Native Ubuntu: skip this paragraph.**

Then, in the Ubuntu terminal (native or WSL2), save the script below as
`setup-resumaker.sh` and run `bash setup-resumaker.sh`:

```bash
#!/usr/bin/env bash
# Resumaker dev bootstrap for WSL2 / Ubuntu 22.04. Idempotent-ish; re-runnable.
set -euo pipefail
log(){ printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

log "APT base packages"
sudo apt-get update -y
sudo apt-get install -y build-essential curl wget git unzip ca-certificates gnupg \
  lsb-release apt-transport-https python3 python3-pip jq

log "Node 22 via nvm + pnpm via corepack"
if [ ! -d "$HOME/.nvm" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 22 && nvm alias default 22
corepack enable && corepack prepare pnpm@9.15.0 --activate

log "pre-commit (via pipx — PEP 668 blocks 'pip --user' on Ubuntu 24.04)"
sudo apt-get install -y pipx
pipx ensurepath
pipx install pre-commit || pipx upgrade pre-commit || true

log "Docker (native Ubuntu only — on Windows/WSL2 use Docker Desktop + WSL integration, skip this)"
if ! command -v docker >/dev/null && ! grep -qi microsoft /proc/version 2>/dev/null; then
  sudo apt-get install -y docker.io
  sudo usermod -aG docker "$USER"
  sudo systemctl enable --now docker || true
  echo ">> Log out/in (or run 'newgrp docker') so docker works without sudo."
fi

log "gh CLI"
if ! command -v gh >/dev/null; then
  (type -p wget >/dev/null || sudo apt-get install -y wget)
  sudo mkdir -p -m 755 /etc/apt/keyrings
  wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null
  sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -y && sudo apt-get install -y gh
fi

log "Google Cloud SDK + gke-gcloud-auth-plugin + kubectl"
if ! command -v gcloud >/dev/null; then
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list >/dev/null
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
  sudo apt-get update -y
  sudo apt-get install -y google-cloud-cli google-cloud-cli-gke-gcloud-auth-plugin kubectl
fi
# NOTE (Windows): the Mac PATH gotcha is gone. apt installs the auth plugin on PATH.

log "Helm"
if ! command -v helm >/dev/null; then
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

log "OpenTofu 1.12.0"
if ! command -v tofu >/dev/null; then
  curl -fsSL https://get.opentofu.org/install-opentofu.sh -o /tmp/inst-tofu.sh
  chmod +x /tmp/inst-tofu.sh && sudo /tmp/inst-tofu.sh --install-method deb
fi

log "Trivy 0.70"
if ! command -v trivy >/dev/null; then
  curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sudo sh -s -- -b /usr/local/bin v0.70.0
fi

log "cloud-sql-proxy (for admin/migrations against private Cloud SQL)"
if ! command -v cloud-sql-proxy >/dev/null; then
  curl -o /tmp/csp https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.14.1/cloud-sql-proxy.linux.amd64
  chmod +x /tmp/csp && sudo mv /tmp/csp /usr/local/bin/cloud-sql-proxy
fi

log "Claude Code CLI"
if ! command -v claude >/dev/null; then
  curl -fsSL https://claude.ai/install.sh | bash || npm i -g @anthropic-ai/claude-code
fi

log "Authenticate (interactive)"
gh auth login || true
gcloud auth login || true
gcloud auth application-default login || true
gcloud config set project resumaker-497309 || true

log "Done. Next: clone the repo, restore secrets + Claude memory, update GKE allowlist."
cat <<'NEXT'
  git clone https://github.com/avigdolrotem/resumaker.git ~/code/resumaker
  cd ~/code/resumaker && pnpm install --frozen-lockfile && pre-commit install

  # 1) Restore the THREE gitignored env files (transfer via password manager /
  #    encrypted USB — NOT chat/email). Then:  chmod 600 .env apps/web/.env apps/web/.env.local
  #
  # 2) Restore Claude Code project memory. On the Mac it lived at:
  #      ~/.claude/projects/-Volumes-Server-Data-code-server-workspace-resumaker/memory/
  #    Claude keys memory by the project's ABSOLUTE path, so on Windows/WSL2 the
  #    folder name changes. With the repo at ~/code/resumaker, copy the memory
  #    files into the new path-encoded dir (Claude creates the parent on first run;
  #    or mkdir -p it):
  #      ~/.claude/projects/-home-<youruser>-code-resumaker/memory/
  #    (slashes in the path become hyphens, leading slash dropped.)
  #
  # 3) Update the GKE control-plane allowlist for THIS machine's new public IP
  #    (kubectl will hang until you do — the Mac's home IP is allowlisted, not this one):
  MYIP=$(curl -s ifconfig.me)
  gcloud container clusters update resumaker-prod --region=europe-west1 \
    --master-authorized-networks="${MYIP}/32" --project=resumaker-497309
  #    (If you want to keep multiple locations, list them comma-separated.)
NEXT
```

### Claude Code plugins/skills

The Mac session used many plugins (superpowers, cicd-automation, security-scanning,
vercel, etc.). Two options to restore them on Windows:

- **Easiest:** copy the whole `~/.claude/` directory from the Mac to WSL2 `~/.claude/`
  (brings plugins + settings + keybindings + memory). The skills are markdown/JS and
  are portable; re-run `claude` once and let it reconcile. Then fix the memory dir
  path per step 2 above.
- **Clean:** re-add the plugin marketplaces/plugins via Claude Code's `/plugin` UI on
  the new machine. The functional set used here: `superpowers`, `commit-commands`,
  `cicd-automation`, `security-scanning`, `kubernetes-operations`, `iac-terraform`,
  `gitops-workflows`, `comprehensive-review`, `pr-review-toolkit`, `playwright-skill`,
  `api-testing`, `api-security-hardening`, `access-control-rbac`, `database-design`,
  `better-auth`, `ui-ux-pro-max`, `vercel` (for shadcn/react reviewers only).

---

## Part 2 — GCP cost-reduction plan (run-rate ≈ $10–13/day idle)

The spend is almost entirely **fixed infrastructure**, not traffic. Confirmed tiers
(2026-05-30):

| Resource                           | Current                              | ~$/mo     | Why it's overkill pre-launch                       |
| ---------------------------------- | ------------------------------------ | --------- | -------------------------------------------------- |
| Cloud SQL `resumaker-prod-pg-1b94` | `db-custom-2-4096` **REGIONAL (HA)** | ~$130–160 | 2 vCPU + synchronous HA standby for **zero users** |
| Memorystore `resumaker-prod-redis` | **STANDARD_HA** 1GB                  | ~$45–55   | HA replica for a cache nobody hits                 |
| GKE Autopilot                      | 3 pods (HPA min 3)                   | ~$60–90   | 3 idle replicas                                    |
| Cloud NAT + GCLB + logging         | —                                    | ~$70–90   | mostly unavoidable while running                   |

### Option A — Downsize (keep prod up, ~$120–160/mo target)

1. **Cloud SQL → ZONAL + smaller tier** (biggest win, ~$100/mo). In-place update,
   brief restart — low risk, short window. In `infra/tofu/modules/cloudsql` set
   `availability_type = "ZONAL"` and `tier = "db-g1-small"` (pre-launch floor for PG15),
   then `tofu -chdir=infra/tofu/environments/prod apply`. (Or quick test via
   `gcloud sql instances patch resumaker-prod-pg-1b94 --availability-type=ZONAL --tier=db-g1-small`,
   then reconcile tofu so state doesn't drift.)
2. **Memorystore → BASIC** (~$25/mo). Tier change is a **recreate** (new IP) →
   update the `REDIS_URL` secret + roll the deployment. Needs a short window. Set
   `tier = "BASIC"` in `infra/tofu/modules/memorystore` and apply; afterwards
   `gcloud secrets versions add redis-url ...` with the new `rediss://…:6378`.
3. **HPA min 3 → 1** (~$20–40/mo). Low risk. In `infra/helm/resumaker/values.prod.yaml`
   set `autoscaling.minReplicas: 1`, `helm upgrade … --force-conflicts`.

### Option B — Mothball between sessions (≈ $1–2/day, recommended while migrating)

You're pre-launch with no users and about to be away. Stop paying for idle compute;
keep only storage. Bring it back in ~5 min when you want to demo.

```bash
# STOP (run when done working):
gcloud sql instances patch resumaker-prod-pg-1b94 --activation-policy=NEVER --project=resumaker-497309
kubectl -n resumaker scale deploy resumaker --replicas=0
# Memorystore can't be stopped (only deleted); leave it or delete+recreate from tofu later.

# START (run to bring prod back):
gcloud sql instances patch resumaker-prod-pg-1b94 --activation-policy=ALWAYS --project=resumaker-497309
kubectl -n resumaker scale deploy resumaker --replicas=3
```

### Always do this regardless

- **Set a hard budget + alerts.** Console → Billing → Budgets & alerts → cap at e.g.
  $150/mo with 50/90/100% email alerts. This is the safety net against a runaway.
- After any of the above, watch **Billing → Reports** grouped by SKU for 24–48h to
  confirm the drop.

---

## Part 3 — Post-migration handoff prompt

Paste the block from the chat message that delivered this file (the
"Paste into the new Claude Code session" block) once setup + verification pass. It
covers: confirm-environment verification, the cost task above, and the prioritized
backlog (synthetic-user QA now that OAuth+DNS work, real-OAuth E2E in CI, optional
ArgoCD for hands-off deploys, decide whether to keep or delete the un-bootstrapped
dev/staging tofu envs, vitest v3 to close the vite CVE, GitHub Pro for branch
protection + Code Scanning).
