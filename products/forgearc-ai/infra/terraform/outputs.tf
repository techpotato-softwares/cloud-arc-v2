output "document_bucket" {
  value = google_storage_bucket.documents.name
}

output "ingest_topic" {
  value = google_pubsub_topic.ingest.id
}

output "firestore_database" {
  value = google_firestore_database.jobs.name
}

output "provider_secret" {
  value = google_secret_manager_secret.providers.id
}

output "database_secret" {
  value = var.enable_alloydb ? google_secret_manager_secret.database_url[0].id : ""
}

output "jwt_secret" {
  value = google_secret_manager_secret.jwt.id
}

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "worker_url" {
  value = google_cloud_run_v2_service.worker.uri
}

output "runtime_mode" {
  value = var.runtime_mode
}

output "migration_job" {
  value = var.enable_alloydb ? google_cloud_run_v2_job.migrate[0].name : ""
}

output "alloydb_ip" {
  value = var.enable_alloydb ? google_alloydb_instance.primary[0].ip_address : ""
}

output "oidc_mode" {
  value = (
    var.oidc_issuer != "" ? "external" :
    var.enable_identity_platform ? "identity_platform" :
    "unset"
  )
}

output "oidc_issuer" {
  value = local.oidc_issuer
}

output "oidc_audience" {
  value = local.oidc_audience
}

output "oidc_jwks_url" {
  value = local.oidc_jwks_url
}

output "regional_kms_key" {
  value = var.enable_cmek ? local.regional_kms_key_id : ""
}

output "pubsub_kms_key" {
  value = var.enable_cmek ? local.pubsub_kms_key_id : ""
}
