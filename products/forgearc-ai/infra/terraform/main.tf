locals {
  name = "forgearc-ai-${var.environment}"
  apis = toset(concat(
    [
      "aiplatform.googleapis.com",
      "alloydb.googleapis.com",
      "artifactregistry.googleapis.com",
      "compute.googleapis.com",
      "firestore.googleapis.com",
      "monitoring.googleapis.com",
      "pubsub.googleapis.com",
      "run.googleapis.com",
      "secretmanager.googleapis.com",
      "servicenetworking.googleapis.com",
      "storage.googleapis.com",
    ],
    var.enable_cmek ? ["cloudkms.googleapis.com"] : [],
    var.enable_identity_platform ? ["identitytoolkit.googleapis.com"] : [],
  ))
  always_on            = var.runtime_mode == "always_on"
  api_min_instances    = coalesce(var.api_min_instances, local.always_on ? 1 : 0)
  worker_min_instances = coalesce(var.worker_min_instances, local.always_on ? 1 : 0)
  api_memory_gib = (
    endswith(var.api_memory, "Gi") ? tonumber(trimsuffix(var.api_memory, "Gi")) :
    tonumber(trimsuffix(var.api_memory, "Mi")) / 1024
  )
  worker_memory_gib = (
    endswith(var.worker_memory, "Gi") ? tonumber(trimsuffix(var.worker_memory, "Gi")) :
    tonumber(trimsuffix(var.worker_memory, "Mi")) / 1024
  )
  database_url = var.enable_alloydb ? format(
    "postgresql+psycopg://%s:%s@%s:5432/%s?sslmode=require",
    var.database_user,
    random_password.database[0].result,
    google_alloydb_instance.primary[0].ip_address,
    var.database_name,
  ) : ""
  runtime_env = merge(
    {
      FORGEARC_AI_ENVIRONMENT        = var.environment == "prod" ? "prod" : "test"
      FORGEARC_AI_CLOUD              = "gcp"
      GCP_PROJECT                    = var.project_id
      GCP_LOCATION                   = var.region
      FORGEARC_AI_SECRET_ID          = google_secret_manager_secret.providers.id
      FORGEARC_AI_BUCKET             = google_storage_bucket.documents.name
      FORGEARC_AI_QUEUE_URL          = google_pubsub_topic.ingest.id
      FORGEARC_AI_FIRESTORE_DATABASE = google_firestore_database.jobs.name
    },
    local.oidc_issuer == "" ? {} : {
      FORGEARC_AI_AUTH_MODE              = "oidc"
      FORGEARC_AI_OIDC_ISSUER            = local.oidc_issuer
      FORGEARC_AI_OIDC_AUDIENCE          = local.oidc_audience
      FORGEARC_AI_OIDC_JWKS_URL          = local.oidc_jwks_url
      FORGEARC_AI_OIDC_TENANT_CLAIM      = "tenant_id"
      FORGEARC_AI_OIDC_PERMISSIONS_CLAIM = "permissions"
      FORGEARC_AI_OIDC_MODULES_CLAIM     = "modules"
      FORGEARC_AI_OIDC_GROUPS_CLAIM      = "groups"
      FORGEARC_AI_OIDC_DEFAULT_MODULES   = "ai"
    },
  )
  run_labels = {
    product      = "forgearc-ai"
    runtime_mode = var.runtime_mode
  }
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

resource "google_service_account" "migrate" {
  count        = var.enable_alloydb ? 1 : 0
  account_id   = "${local.name}-migrate"
  display_name = "ForgeArc AI database migrations"
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

  dynamic "encryption" {
    for_each = var.enable_cmek ? [1] : []
    content {
      default_kms_key_name = local.regional_kms_key_id
    }
  }

  depends_on = [google_kms_crypto_key_iam_member.storage]
}

resource "google_pubsub_topic" "dead_letter" {
  name         = "${local.name}-ingest-dead"
  kms_key_name = var.enable_cmek ? local.pubsub_kms_key_id : null

  depends_on = [google_kms_crypto_key_iam_member.pubsub]
}

resource "google_pubsub_topic" "ingest" {
  name         = "${local.name}-ingest"
  kms_key_name = var.enable_cmek ? local.pubsub_kms_key_id : null

  depends_on = [google_kms_crypto_key_iam_member.pubsub]
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
      audience              = google_cloud_run_v2_service.worker.uri
    }
  }

  depends_on = [google_pubsub_topic_iam_member.dead_letter_publisher]
}

resource "google_pubsub_subscription" "dead_letter" {
  name                       = "${local.name}-ingest-dead-pull"
  topic                      = google_pubsub_topic.dead_letter.id
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  expiration_policy {
    ttl = ""
  }
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
    dynamic "auto" {
      for_each = var.enable_cmek ? [] : [1]
      content {}
    }
    dynamic "user_managed" {
      for_each = var.enable_cmek ? [1] : []
      content {
        replicas {
          location = var.region
          customer_managed_encryption {
            kms_key_name = local.regional_kms_key_id
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_kms_crypto_key_iam_member.secrets,
  ]
}

resource "google_secret_manager_secret" "jwt" {
  secret_id = "${local.name}-jwt"

  replication {
    dynamic "auto" {
      for_each = var.enable_cmek ? [] : [1]
      content {}
    }
    dynamic "user_managed" {
      for_each = var.enable_cmek ? [1] : []
      content {
        replicas {
          location = var.region
          customer_managed_encryption {
            kms_key_name = local.regional_kms_key_id
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_kms_crypto_key_iam_member.secrets,
  ]
}

resource "google_secret_manager_secret" "database_url" {
  count     = var.enable_alloydb ? 1 : 0
  secret_id = "${local.name}-database-url"

  replication {
    dynamic "auto" {
      for_each = var.enable_cmek ? [] : [1]
      content {}
    }
    dynamic "user_managed" {
      for_each = var.enable_cmek ? [1] : []
      content {
        replicas {
          location = var.region
          customer_managed_encryption {
            kms_key_name = local.regional_kms_key_id
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_kms_crypto_key_iam_member.secrets,
  ]
}

resource "random_password" "database" {
  count   = var.enable_alloydb ? 1 : 0
  length  = 32
  special = false
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "google_secret_manager_secret_version" "database" {
  count  = var.enable_alloydb ? 1 : 0
  secret = google_secret_manager_secret.providers.id
  secret_data = jsonencode({
    databasePassword = random_password.database[0].result
    databaseUrl      = local.database_url
  })

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_secret_manager_secret_version" "jwt" {
  secret      = google_secret_manager_secret.jwt.id
  secret_data = random_password.jwt.result

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  count       = var.enable_alloydb ? 1 : 0
  secret      = google_secret_manager_secret.database_url[0].id
  secret_data = local.database_url

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_network" "ai" {
  count                   = var.enable_alloydb ? 1 : 0
  name                    = local.name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "runtime" {
  count                    = var.enable_alloydb ? 1 : 0
  name                     = "${local.name}-run"
  ip_cidr_range            = var.runtime_subnet_cidr
  region                   = var.region
  network                  = google_compute_network.ai[0].id
  private_ip_google_access = true
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
    user     = var.database_user
    password = random_password.database[0].result
  }

  database_version = "POSTGRES_15"

  continuous_backup_config {
    enabled              = true
    recovery_window_days = var.alloydb_recovery_window_days
  }

  automated_backup_policy {
    location      = var.region
    backup_window = "3600s"
    enabled       = true

    weekly_schedule {
      days_of_week = [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ]

      start_times {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }

    quantity_based_retention {
      count = var.alloydb_backup_retention_count
    }
  }

  depends_on = [google_service_networking_connection.private]
}

resource "google_alloydb_instance" "primary" {
  count             = var.enable_alloydb ? 1 : 0
  cluster           = google_alloydb_cluster.vectors[0].name
  instance_id       = "primary"
  instance_type     = "PRIMARY"
  availability_type = var.alloydb_availability_type

  machine_config {
    cpu_count = var.alloydb_cpu_count
  }
}

resource "google_cloud_run_v2_service" "api" {
  name                = "${local.name}-api"
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = var.environment == "prod"
  labels              = merge(local.run_labels, { component = "api" })

  template {
    service_account                  = google_service_account.api.email
    timeout                          = var.api_timeout
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = var.api_concurrency

    scaling {
      min_instance_count = local.api_min_instances
      max_instance_count = var.api_max_instances
    }

    dynamic "vpc_access" {
      for_each = var.enable_alloydb ? [1] : []
      content {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = google_compute_network.ai[0].name
          subnetwork = google_compute_subnetwork.runtime[0].name
        }
      }
    }

    containers {
      image = var.container_image

      ports {
        name           = "http1"
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.api_cpu
          memory = var.api_memory
        }
        cpu_idle          = var.runtime_mode == "serverless"
        startup_cpu_boost = true
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 12
        http_get {
          path = "/health"
          port = var.container_port
        }
      }

      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = "/health"
          port = var.container_port
        }
      }

      dynamic "env" {
        for_each = local.runtime_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.enable_alloydb ? [1] : []
        content {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url[0].secret_id
              version = "latest"
            }
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.api_secret,
    google_secret_manager_secret_iam_member.api_jwt,
    google_secret_manager_secret_iam_member.api_database,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.jwt,
    google_compute_subnetwork_iam_member.serverless,
  ]
}

resource "google_cloud_run_v2_service" "worker" {
  name                = "${local.name}-worker"
  location            = var.region
  ingress             = var.worker_ingress
  deletion_protection = var.environment == "prod"
  labels              = merge(local.run_labels, { component = "worker" })

  template {
    service_account                  = google_service_account.worker.email
    timeout                          = var.worker_timeout
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = var.worker_concurrency

    scaling {
      min_instance_count = local.worker_min_instances
      max_instance_count = var.worker_max_instances
    }

    dynamic "vpc_access" {
      for_each = var.enable_alloydb ? [1] : []
      content {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = google_compute_network.ai[0].name
          subnetwork = google_compute_subnetwork.runtime[0].name
        }
      }
    }

    containers {
      image = var.container_image

      ports {
        name           = "http1"
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.worker_cpu
          memory = var.worker_memory
        }
        cpu_idle          = var.runtime_mode == "serverless"
        startup_cpu_boost = true
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 10
        failure_threshold     = 12
        http_get {
          path = "/health"
          port = var.container_port
        }
      }

      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = "/health"
          port = var.container_port
        }
      }

      dynamic "env" {
        for_each = local.runtime_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.enable_alloydb ? [1] : []
        content {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url[0].secret_id
              version = "latest"
            }
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.worker_secret,
    google_secret_manager_secret_iam_member.worker_jwt,
    google_secret_manager_secret_iam_member.worker_database,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.jwt,
    google_compute_subnetwork_iam_member.serverless,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "worker_invoker" {
  name     = google_cloud_run_v2_service.worker.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_cloud_run_v2_job" "migrate" {
  count               = var.enable_alloydb ? 1 : 0
  name                = "${local.name}-migrate"
  location            = var.region
  deletion_protection = var.environment == "prod"
  labels              = merge(local.run_labels, { component = "migrate" })

  template {
    template {
      service_account       = google_service_account.migrate[0].email
      timeout               = var.migration_timeout
      max_retries           = 1
      execution_environment = "EXECUTION_ENVIRONMENT_GEN2"

      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = google_compute_network.ai[0].name
          subnetwork = google_compute_subnetwork.runtime[0].name
        }
      }

      containers {
        image       = var.container_image
        command     = var.migration_command
        args        = var.migration_args
        working_dir = var.migration_working_dir != "" ? var.migration_working_dir : null

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.database_url[0].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required,
    google_secret_manager_secret_iam_member.migrate_database,
    google_secret_manager_secret_version.database_url,
    google_compute_subnetwork_iam_member.serverless,
    google_alloydb_instance.primary,
  ]
}

resource "terraform_data" "production_guard" {
  input = {
    environment  = var.environment
    runtime_mode = var.runtime_mode
    alloydb      = var.enable_alloydb
    identity     = local.production_identity_configured
  }

  lifecycle {
    precondition {
      condition     = var.environment != "prod" || var.enable_alloydb
      error_message = "AlloyDB is required when environment is prod."
    }

    precondition {
      condition     = var.environment != "prod" || local.production_identity_configured
      error_message = "Production requires enable_identity_platform, or oidc_issuer, oidc_audience, and oidc_jwks_url."
    }

    precondition {
      condition = (
        (var.oidc_issuer == "" && var.oidc_audience == "" && var.oidc_jwks_url == "") ||
        (var.oidc_issuer != "" && var.oidc_audience != "" && var.oidc_jwks_url != "")
      )
      error_message = "Set oidc_issuer, oidc_audience, and oidc_jwks_url together."
    }

    precondition {
      condition = (
        local.api_min_instances <= var.api_max_instances &&
        local.worker_min_instances <= var.worker_max_instances &&
        (
          var.runtime_mode == "always_on"
          ? local.api_min_instances >= 1 && local.worker_min_instances >= 1
          : local.api_min_instances == 0 && local.worker_min_instances == 0
        )
      )
      error_message = "serverless requires minimum instances of 0. always_on requires minimum instances of at least 1, and minimums cannot exceed maximums."
    }

    precondition {
      condition = (
        (!contains(["4", "8"], var.api_cpu) || local.api_memory_gib >= 2) &&
        (!contains(["4", "8"], var.worker_cpu) || local.worker_memory_gib >= 2)
      )
      error_message = "Cloud Run requires at least 2Gi of memory when CPU is 4 or 8."
    }
  }
}
