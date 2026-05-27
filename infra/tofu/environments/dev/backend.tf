terraform {
  backend "gcs" {
    bucket = "resumaker-dev-tfstate"
    prefix = "tofu/state"
  }
}
