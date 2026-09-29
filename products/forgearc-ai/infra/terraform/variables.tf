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
  description = "Deployment name appended to resource ids."
  type        = string
  default     = "dev"
}

variable "container_image" {
  description = "Container image for the API and ingestion worker."
  type        = string
}

variable "enable_alloydb" {
  description = "Create the AlloyDB pgvector database. Disable only for a storage-and-queue preview."
  type        = bool
  default     = true
}
