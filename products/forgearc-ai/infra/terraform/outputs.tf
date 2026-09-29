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

output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "alloydb_ip" {
  value = var.enable_alloydb ? google_alloydb_instance.primary[0].ip_address : ""
}
