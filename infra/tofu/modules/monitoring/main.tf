/**
 * Cloud Monitoring uptime check for the public Resumaker app.
 *
 * Hits `${var.host}${var.path}` over HTTPS every `var.period_sec`
 * seconds from a spread of GCP probe regions. The target response is
 * the `/api/health` JSON `{"status":"ok",...}` — we match the literal
 * `"status":"ok"` substring so a 200 with a misleading body (a stale
 * cached "ready" response from a misconfigured CDN, for example) still
 * fails the check.
 *
 * Alert routing is intentionally NOT wired here — notification
 * channels are managed separately so the same uptime config can be
 * pointed at different on-call destinations across environments
 * without churning this module. Wire `google_monitoring_alert_policy`
 * + channels in the env-level main.tf when ready.
 */

resource "google_monitoring_uptime_check_config" "app" {
  project      = var.project_id
  display_name = "${var.env}-${var.host}-health"
  timeout      = var.timeout_sec
  period       = var.period_sec

  http_check {
    path           = var.path
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.host
    }
  }

  content_matchers {
    content = "\"status\":\"ok\""
    matcher = "CONTAINS_STRING"
  }

  selected_regions = var.regions
}
