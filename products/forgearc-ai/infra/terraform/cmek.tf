locals {
  regional_kms_key_id  = var.kms_key_name != "" ? var.kms_key_name : try(google_kms_crypto_key.regional[0].id, "")
  pubsub_kms_key_id    = var.pubsub_kms_key_name != "" ? var.pubsub_kms_key_name : try(google_kms_crypto_key.pubsub[0].id, "")
  secret_manager_agent = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-secretmanager.iam.gserviceaccount.com"
  storage_agent        = "serviceAccount:service-${data.google_project.current.number}@gs-project-accounts.iam.gserviceaccount.com"
}

resource "google_kms_key_ring" "regional" {
  count    = var.enable_cmek && var.kms_key_name == "" ? 1 : 0
  name     = local.name
  location = var.region

  depends_on = [google_project_service.required]
}

resource "google_kms_crypto_key" "regional" {
  count           = var.enable_cmek && var.kms_key_name == "" ? 1 : 0
  name            = "data"
  key_ring        = google_kms_key_ring.regional[0].id
  rotation_period = "7776000s"
}

resource "google_kms_key_ring" "global" {
  count    = var.enable_cmek && var.pubsub_kms_key_name == "" ? 1 : 0
  name     = local.name
  location = "global"

  depends_on = [google_project_service.required]
}

resource "google_kms_crypto_key" "pubsub" {
  count           = var.enable_cmek && var.pubsub_kms_key_name == "" ? 1 : 0
  name            = "pubsub"
  key_ring        = google_kms_key_ring.global[0].id
  rotation_period = "7776000s"
}

resource "google_kms_crypto_key_iam_member" "storage" {
  count         = var.enable_cmek ? 1 : 0
  crypto_key_id = local.regional_kms_key_id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = local.storage_agent
}

resource "google_kms_crypto_key_iam_member" "secrets" {
  count         = var.enable_cmek ? 1 : 0
  crypto_key_id = local.regional_kms_key_id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = local.secret_manager_agent
}

resource "google_kms_crypto_key_iam_member" "pubsub" {
  count         = var.enable_cmek ? 1 : 0
  crypto_key_id = local.pubsub_kms_key_id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = local.pubsub_service_agent
}
