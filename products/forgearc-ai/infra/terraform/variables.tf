variable "project_id" {
  description = "GCP project that hosts ForgeArc AI."
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, AlloyDB, Pub/Sub, and Firestore."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment name appended to resource ids. prod requires AlloyDB and Identity Platform or external OIDC."
  type        = string
  default     = "dev"

  validation {
    condition     = can(regex("^[a-z](?:[a-z0-9-]{0,8}[a-z0-9])?$", var.environment))
    error_message = "environment must be 1-10 lowercase letters, numbers, or hyphens so service account ids stay within 30 characters."
  }
}

variable "container_image" {
  description = "Container image for the API, ingestion worker, and migration job."
  type        = string
}

variable "container_port" {
  description = "Port the API and worker containers listen on. Cloud Run probes use /health on this port."
  type        = number
  default     = 8080

  validation {
    condition     = var.container_port > 0 && var.container_port < 65536
    error_message = "container_port must be a TCP port."
  }
}

variable "runtime_mode" {
  description = "serverless scales Cloud Run to zero. always_on keeps at least one instance with CPU always allocated."
  type        = string
  default     = "serverless"

  validation {
    condition     = contains(["serverless", "always_on"], var.runtime_mode)
    error_message = "runtime_mode must be serverless or always_on."
  }
}

variable "api_min_instances" {
  description = "Minimum API instances. Null uses 0 for serverless and 1 for always_on."
  type        = number
  default     = null

  validation {
    condition     = coalesce(var.api_min_instances, 0) >= 0
    error_message = "api_min_instances must be zero or greater."
  }
}

variable "api_max_instances" {
  description = "Maximum API instances."
  type        = number
  default     = 10

  validation {
    condition     = var.api_max_instances >= 1
    error_message = "api_max_instances must be at least 1."
  }
}

variable "worker_min_instances" {
  description = "Minimum worker instances. Null uses 0 for serverless and 1 for always_on."
  type        = number
  default     = null

  validation {
    condition     = coalesce(var.worker_min_instances, 0) >= 0
    error_message = "worker_min_instances must be zero or greater."
  }
}

variable "worker_max_instances" {
  description = "Maximum worker instances."
  type        = number
  default     = 10

  validation {
    condition     = var.worker_max_instances >= 1
    error_message = "worker_max_instances must be at least 1."
  }
}

variable "api_cpu" {
  description = "API CPU limit. Cloud Run accepts 1, 2, 4, or 8."
  type        = string
  default     = "1"

  validation {
    condition     = contains(["1", "2", "4", "8"], var.api_cpu)
    error_message = "api_cpu must be 1, 2, 4, or 8."
  }
}

variable "api_memory" {
  description = "API memory limit, such as 512Mi or 2Gi. Four or eight CPUs require at least 2Gi."
  type        = string
  default     = "512Mi"

  validation {
    condition     = can(regex("^[1-9][0-9]*(Mi|Gi)$", var.api_memory))
    error_message = "api_memory must look like 512Mi or 2Gi."
  }
}

variable "worker_cpu" {
  description = "Worker CPU limit. Cloud Run accepts 1, 2, 4, or 8."
  type        = string
  default     = "1"

  validation {
    condition     = contains(["1", "2", "4", "8"], var.worker_cpu)
    error_message = "worker_cpu must be 1, 2, 4, or 8."
  }
}

variable "worker_memory" {
  description = "Worker memory limit, such as 1Gi or 2Gi. Four or eight CPUs require at least 2Gi."
  type        = string
  default     = "1Gi"

  validation {
    condition     = can(regex("^[1-9][0-9]*(Mi|Gi)$", var.worker_memory))
    error_message = "worker_memory must look like 512Mi or 2Gi."
  }
}

variable "api_concurrency" {
  description = "Maximum concurrent requests per API instance."
  type        = number
  default     = 80

  validation {
    condition     = var.api_concurrency >= 1 && var.api_concurrency <= 1000
    error_message = "api_concurrency must be from 1 to 1000."
  }
}

variable "worker_concurrency" {
  description = "Maximum concurrent Pub/Sub pushes per worker instance."
  type        = number
  default     = 4

  validation {
    condition     = var.worker_concurrency >= 1 && var.worker_concurrency <= 1000
    error_message = "worker_concurrency must be from 1 to 1000."
  }
}

variable "api_timeout" {
  description = "API request timeout."
  type        = string
  default     = "300s"
}

variable "worker_timeout" {
  description = "Worker request timeout. Must cover ingestion."
  type        = string
  default     = "180s"
}

variable "worker_ingress" {
  description = "Worker ingress. Same-project Pub/Sub push with OIDC uses internal ingress."
  type        = string
  default     = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  validation {
    condition = contains([
      "INGRESS_TRAFFIC_ALL",
      "INGRESS_TRAFFIC_INTERNAL_ONLY",
      "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER",
    ], var.worker_ingress)
    error_message = "worker_ingress must be a Cloud Run v2 ingress value."
  }
}

variable "enable_alloydb" {
  description = "Create AlloyDB pgvector and inject DATABASE_URL. Required when environment is prod."
  type        = bool
  default     = true
}

variable "database_user" {
  description = "AlloyDB initial user."
  type        = string
  default     = "forgearc"
}

variable "database_name" {
  description = "Database name in DATABASE_URL. AlloyDB creates postgres until a migration creates another database."
  type        = string
  default     = "postgres"
}

variable "alloydb_cpu_count" {
  description = "Primary AlloyDB instance vCPUs."
  type        = number
  default     = 2

  validation {
    condition     = contains([2, 4, 8, 16, 32, 64, 96, 128], var.alloydb_cpu_count)
    error_message = "alloydb_cpu_count must be an AlloyDB machine size."
  }
}

variable "alloydb_availability_type" {
  description = "AlloyDB primary availability. REGIONAL is high availability."
  type        = string
  default     = "ZONAL"

  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.alloydb_availability_type)
    error_message = "alloydb_availability_type must be ZONAL or REGIONAL."
  }
}

variable "alloydb_backup_retention_count" {
  description = "Number of automated AlloyDB backups to retain."
  type        = number
  default     = 14

  validation {
    condition     = var.alloydb_backup_retention_count >= 1 && var.alloydb_backup_retention_count <= 365
    error_message = "alloydb_backup_retention_count must be from 1 to 365."
  }
}

variable "alloydb_recovery_window_days" {
  description = "Continuous backup recovery window in days."
  type        = number
  default     = 14

  validation {
    condition     = var.alloydb_recovery_window_days >= 1 && var.alloydb_recovery_window_days <= 35
    error_message = "alloydb_recovery_window_days must be from 1 to 35."
  }
}

variable "runtime_subnet_cidr" {
  description = "CIDR for the Cloud Run Direct VPC egress subnet. Must not overlap the private services range."
  type        = string
  default     = "192.168.16.0/24"

  validation {
    condition     = can(cidrhost(var.runtime_subnet_cidr, 0))
    error_message = "runtime_subnet_cidr must be a valid CIDR."
  }
}

variable "migration_command" {
  description = "Cloud Run Job command. Overrides the image entrypoint."
  type        = list(string)
  default     = ["/app/entrypoint.sh"]
}

variable "migration_args" {
  description = "Arguments for the migration job."
  type        = list(string)
  default     = ["migrate"]
}

variable "migration_working_dir" {
  description = "Working directory for the migration job. Empty uses the image default."
  type        = string
  default     = ""
}

variable "migration_timeout" {
  description = "Migration job attempt timeout."
  type        = string
  default     = "900s"
}

variable "enable_cmek" {
  description = "Encrypt Cloud Storage, Pub/Sub, and Secret Manager with customer-managed keys."
  type        = bool
  default     = false
}

variable "kms_key_name" {
  description = "Existing regional CMEK for Storage and Secret Manager. Empty creates a key when enable_cmek is true."
  type        = string
  default     = ""
}

variable "pubsub_kms_key_name" {
  description = "Existing global CMEK for Pub/Sub. Empty creates a global key when enable_cmek is true."
  type        = string
  default     = ""
}

variable "enable_identity_platform" {
  description = "Provision Identity Platform. Production can use this or oidc_issuer, oidc_audience, and oidc_jwks_url."
  type        = bool
  default     = false
}

variable "identity_platform_authorized_domains" {
  description = "Hostnames allowed to use Identity Platform. The Cloud Run API host is added."
  type        = list(string)
  default     = ["localhost"]

  validation {
    condition = alltrue([
      for domain in var.identity_platform_authorized_domains :
      !strcontains(domain, "://") && length(domain) > 0
    ])
    error_message = "identity_platform_authorized_domains entries must be hostnames without a scheme."
  }
}

variable "oidc_issuer" {
  description = "External OIDC issuer. Overrides the Identity Platform issuer when set."
  type        = string
  default     = ""

  validation {
    condition     = var.oidc_issuer == "" || startswith(var.oidc_issuer, "https://")
    error_message = "oidc_issuer must be empty or an https URL."
  }
}

variable "oidc_audience" {
  description = "Expected OIDC audience. Identity Platform uses the project id."
  type        = string
  default     = ""
}

variable "oidc_jwks_url" {
  description = "JWKS URL for the external issuer."
  type        = string
  default     = ""

  validation {
    condition     = var.oidc_jwks_url == "" || startswith(var.oidc_jwks_url, "https://")
    error_message = "oidc_jwks_url must be empty or an https URL."
  }
}

variable "notification_channels" {
  description = "Cloud Monitoring notification channel ids that receive runtime alerts."
  type        = list(string)
  default     = []
}

variable "request_latency_threshold_ms" {
  description = "Alert when API or worker p95 latency stays above this many milliseconds."
  type        = number
  default     = 2000
}

variable "alloydb_connection_alert_threshold" {
  description = "Alert when AlloyDB connections stay above this count."
  type        = number
  default     = 200
}
