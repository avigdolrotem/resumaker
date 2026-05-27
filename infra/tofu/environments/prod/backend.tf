terraform {
  backend "gcs" {
    bucket = "resumaker-prod-tfstate"
    prefix = "tofu/state"
  }
}
