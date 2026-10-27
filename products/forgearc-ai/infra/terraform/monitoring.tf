locals {
  alert_labels = {
    product     = "forgearc-ai"
    environment = var.environment
  }
}

resource "google_monitoring_alert_policy" "dead_letter" {
  display_name          = "${local.name} dead-letter messages"
  combiner              = "OR"
  notification_channels = var.notification_channels
  user_labels           = local.alert_labels

  documentation {
    mime_type = "text/markdown"
    content   = "Pub/Sub delivered an ingestion message to the dead-letter topic. Inspect `${google_pubsub_subscription.dead_letter.name}`."
  }

  conditions {
    display_name = "Undelivered dead-letter messages"
    condition_threshold {
      filter                  = "resource.type=\"pubsub_subscription\" AND resource.labels.subscription_id=\"${google_pubsub_subscription.dead_letter.name}\" AND metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\""
      duration                = "60s"
      comparison              = "COMPARISON_GT"
      threshold_value         = 0
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.subscription_id"]
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_monitoring_alert_policy" "http_5xx" {
  display_name          = "${local.name} Cloud Run 5xx"
  combiner              = "OR"
  notification_channels = var.notification_channels
  user_labels           = local.alert_labels

  documentation {
    mime_type = "text/markdown"
    content   = "API or worker 5xx responses stayed above 5 per minute."
  }

  conditions {
    display_name = "API 5xx"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.api.name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration                = "300s"
      comparison              = "COMPARISON_GT"
      threshold_value         = 5
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  conditions {
    display_name = "Worker 5xx"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.worker.name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class=\"5xx\""
      duration                = "300s"
      comparison              = "COMPARISON_GT"
      threshold_value         = 5
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_monitoring_alert_policy" "latency" {
  display_name          = "${local.name} Cloud Run latency"
  combiner              = "OR"
  notification_channels = var.notification_channels
  user_labels           = local.alert_labels

  documentation {
    mime_type = "text/markdown"
    content   = "API or worker p95 latency stayed above ${var.request_latency_threshold_ms} ms."
  }

  conditions {
    display_name = "API p95 latency"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.api.name}\" AND metric.type=\"run.googleapis.com/request_latencies\""
      duration                = "300s"
      comparison              = "COMPARISON_GT"
      threshold_value         = var.request_latency_threshold_ms
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  conditions {
    display_name = "Worker p95 latency"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.worker.name}\" AND metric.type=\"run.googleapis.com/request_latencies\""
      duration                = "300s"
      comparison              = "COMPARISON_GT"
      threshold_value         = var.request_latency_threshold_ms
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_monitoring_alert_policy" "instance_count" {
  display_name          = "${local.name} Cloud Run instance saturation"
  combiner              = "OR"
  notification_channels = var.notification_channels
  user_labels           = local.alert_labels

  documentation {
    mime_type = "text/markdown"
    content   = "API or worker instance count reached its configured maximum."
  }

  conditions {
    display_name = "API instances at maximum"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.api.name}\" AND metric.type=\"run.googleapis.com/container/instance_count\""
      duration                = "300s"
      comparison              = "COMPARISON_GE"
      threshold_value         = var.api_max_instances
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  conditions {
    display_name = "Worker instances at maximum"
    condition_threshold {
      filter                  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.worker.name}\" AND metric.type=\"run.googleapis.com/container/instance_count\""
      duration                = "300s"
      comparison              = "COMPARISON_GE"
      threshold_value         = var.worker_max_instances
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_MAX"
        group_by_fields      = ["resource.labels.service_name"]
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_monitoring_alert_policy" "alloydb_connections" {
  count                 = var.enable_alloydb ? 1 : 0
  display_name          = "${local.name} AlloyDB connections"
  combiner              = "OR"
  notification_channels = var.notification_channels
  user_labels           = local.alert_labels

  documentation {
    mime_type = "text/markdown"
    content   = "AlloyDB connections stayed above ${var.alloydb_connection_alert_threshold}."
  }

  conditions {
    display_name = "Primary database connections"
    condition_threshold {
      filter                  = "resource.type=\"alloydb.googleapis.com/Database\" AND resource.labels.cluster_id=\"${google_alloydb_cluster.vectors[0].cluster_id}\" AND resource.labels.instance_id=\"primary\" AND metric.type=\"alloydb.googleapis.com/database/postgresql/backends\""
      duration                = "300s"
      comparison              = "COMPARISON_GT"
      threshold_value         = var.alloydb_connection_alert_threshold
      evaluation_missing_data = "EVALUATION_MISSING_DATA_INACTIVE"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_MAX"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields      = ["resource.labels.instance_id"]
      }
    }
  }

  depends_on = [google_project_service.required]
}
