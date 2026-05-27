# Network module (GCP)

Creates: VPC, subnet (with secondary ranges for GKE pods/services), private services range for Cloud SQL/Memorystore peering, Cloud Router + Cloud NAT.

## Inputs

| Variable                | Description                             |
| ----------------------- | --------------------------------------- |
| `project_id`            | GCP project ID                          |
| `region`                | GCP region (default `europe-west1`)     |
| `env`                   | `dev` \| `staging` \| `prod`            |
| `vpc_cidr`              | Primary CIDR (e.g. `10.0.0.0/16`)       |
| `subnet_cidr`           | `/24` subnet for nodes                  |
| `pods_cidr`             | `/20` secondary for GKE pods            |
| `services_cidr`         | `/20` secondary for GKE services        |
| `private_services_cidr` | `/16` for Cloud SQL/Memorystore peering |

## Outputs

`network_id`, `network_name`, `network_self_link`, `subnet_id`, `subnet_name`, `subnet_self_link`, `pods_range_name`, `services_range_name`, `private_services_connection`.

## Per-env CIDRs (chosen)

| env     | VPC         | subnet      | pods         | services     | private services |
| ------- | ----------- | ----------- | ------------ | ------------ | ---------------- |
| dev     | 10.0.0.0/16 | 10.0.1.0/24 | 10.0.16.0/20 | 10.0.32.0/20 | 10.128.0.0/16    |
| staging | 10.1.0.0/16 | 10.1.1.0/24 | 10.1.16.0/20 | 10.1.32.0/20 | 10.129.0.0/16    |
| prod    | 10.2.0.0/16 | 10.2.1.0/24 | 10.2.16.0/20 | 10.2.32.0/20 | 10.130.0.0/16    |
