terraform {
  backend "gcs" {
    bucket = "resumaker-staging-tfstate"
    prefix = "tofu/state"
  }
}
