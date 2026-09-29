locals {
  name = "forgearc-ai-${var.environment}"
  apis = toset([
    "aiplatform.googleapis.com",
    "alloydb.googleapis.com",
    "artifactregistry.googleapis.com",
    "compute.googleapis.com",
    "firestore.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "storage.googleapis.com",
  ])
}

resource "google_project_service" "required" {
  for_each = local.apis
  service  = each.value
}

resource "google_service_account" "api" {
  account_id   = "${local.name}-api"
  display_name = "ForgeArc AI API"
}

resource "google_service_account" "worker" {
  account_id   = "${local.name}-worker"
  display_name = "ForgeArc AI ingestion worker"
}

resource "google_storage_bucket" "documents" {
  name                        = "${var.project_id}-${local.name}-documents"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }
}

resource "google_pubsub_topic" "dead_letter" {
  name = "${local.name}-ingest-dead"
}

resource "google_pubsub_topic" "ingest" {
  name = "${local.name}-ingest"
}

resource "google_pubsub_subscription" "worker" {
  name                 = "${local.name}-ingest-worker"
  topic                = google_pubsub_topic.ingest.id
  ack_deadline_seconds = 180

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker.uri}/internal/pubsub"
    oidc_token {
      service_account_email = google_service_account.worker.email
    }
  }

  depends_on = [google_pubsub_topic_iam_member.dead_letter_publisher]
}

resource "google_firestore_database" "jobs" {
  name        = local.name
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret" "providers" {
  secret_id = local.name

  replication {
    auto {}
  }
}

resource "random_password" "database" {
  count   = var.enable_alloydb ? 1 : 0
  length  = 32
  special = false
}

resource "google_secret_manager_secret_version" "database" {
  count       = var.enable_alloydb ? 1 : 0
  secret      = google_secret_manager_secret.providers.id
  secret_data = jsonencode({ databasePassword = random_password.database[0].result })
}

resource "google_compute_network" "ai" {
  count                   = var.enable_alloydb ? 1 : 0
  name                    = local.name
  auto_create_subnetworks = false
}

resource "google_compute_global_address" "private" {
  count         = var.enable_alloydb ? 1 : 0
  name          = "${local.name}-private"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.ai[0].id
}

resource "google_service_networking_connection" "private" {
  count                   = var.enable_alloydb ? 1 : 0
  network                 = google_compute_network.ai[0].id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private[0].name]

  depends_on = [google_project_service.required]
}

resource "google_alloydb_cluster" "vectors" {
  count      = var.enable_alloydb ? 1 : 0
  cluster_id = local.name
  location   = var.region

  network_config {
    network = google_compute_network.ai[0].id
  }

  initial_user {
    user     = "forgearc"
    password = random_password.database[0].result
  }

  depends_on = [google_service_networking_connection.private]
}

resource "google_alloydb_instance" "primary" {
  count         = var.enable_alloydb ? 1 : 0
  cluster       = google_alloydb_cluster.vectors[0].name
  instance_id   = "primary"
  instance_type = "PRIMARY"

  machine_config {
    cpu_count = 2
  }
}

resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api.email
    containers {
      image = var.container_image
      env {
        name  = "FORGEARC_AI_ENVIRONMENT"
        value = "prod"
      }
      env {
        name  = "FORGEARC_AI_CLOUD"
        value = "gcp"
      }
      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCP_LOCATION"
        value = var.region
      }
      env {
        name  = "FORGEARC_AI_SECRET_ID"
        value = google_secret_manager_secret.providers.id
      }
      env {
        name  = "FORGEARC_AI_BUCKET"
        value = google_storage_bucket.documents.name
      }
      env {
        name  = "FORGEARC_AI_QUEUE_URL"
        value = google_pubsub_topic.ingest.id
      }
      env {
        name  = "FORGEARC_AI_FIRESTORE_DATABASE"
        value = google_firestore_database.jobs.name
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "${local.name}-worker"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.worker.email
    timeout         = "180s"
    containers {
      image = var.container_image
      env {
        name  = "FORGEARC_AI_ENVIRONMENT"
        value = "prod"
      }
      env {
        name  = "FORGEARC_AI_CLOUD"
        value = "gcp"
      }
      env {
        name  = "GCP_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCP_LOCATION"
        value = var.region
      }
      env {
        name  = "FORGEARC_AI_SECRET_ID"
        value = google_secret_manager_secret.providers.id
      }
      env {
        name  = "FORGEARC_AI_BUCKET"
        value = google_storage_bucket.documents.name
      }
      env {
        name  = "FORGEARC_AI_QUEUE_URL"
        value = google_pubsub_topic.ingest.id
      }
      env {
        name  = "FORGEARC_AI_FIRESTORE_DATABASE"
        value = google_firestore_database.jobs.name
      }
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  name     = google_cloud_run_v2_service.worker.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.worker.email}"
}
