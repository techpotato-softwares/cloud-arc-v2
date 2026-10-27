mock_provider "google" {}

mock_provider "random" {}

variables {
  project_id      = "demo-project"
  container_image = "us-central1-docker.pkg.dev/demo-project/forgearc/api:1"
}

run "serverless_scales_to_zero" {
  command = plan

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].scaling[0].min_instance_count == 0
    error_message = "Serverless API minimum instances must be 0."
  }

  assert {
    condition     = google_cloud_run_v2_service.worker.template[0].scaling[0].min_instance_count == 0
    error_message = "Serverless worker minimum instances must be 0."
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].resources[0].cpu_idle == true
    error_message = "Serverless API CPU must be allocated only during requests."
  }

  assert {
    condition     = google_cloud_run_v2_service.worker.ingress == "INGRESS_TRAFFIC_INTERNAL_ONLY"
    error_message = "Worker ingress must be internal."
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].vpc_access[0].egress == "PRIVATE_RANGES_ONLY"
    error_message = "AlloyDB traffic must use Direct VPC egress for private ranges."
  }

  assert {
    condition = contains(
      [for item in google_cloud_run_v2_service.api.template[0].containers[0].env : item.name],
      "DATABASE_URL",
    )
    error_message = "API must receive DATABASE_URL when AlloyDB is enabled."
  }
}

run "always_on_keeps_instances" {
  command = plan

  variables {
    runtime_mode = "always_on"
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].scaling[0].min_instance_count == 1
    error_message = "Always-on API minimum instances must be at least 1."
  }

  assert {
    condition     = google_cloud_run_v2_service.worker.template[0].scaling[0].min_instance_count == 1
    error_message = "Always-on worker minimum instances must be at least 1."
  }

  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].resources[0].cpu_idle == false
    error_message = "Always-on API must keep CPU allocated."
  }

  assert {
    condition     = google_cloud_run_v2_service.worker.template[0].containers[0].resources[0].cpu_idle == false
    error_message = "Always-on worker must keep CPU allocated."
  }
}

run "prod_requires_alloydb" {
  command = plan

  variables {
    environment              = "prod"
    enable_alloydb           = false
    enable_identity_platform = true
  }

  expect_failures = [
    terraform_data.production_guard,
  ]
}

run "prod_requires_identity" {
  command = plan

  variables {
    environment              = "prod"
    enable_alloydb           = true
    enable_identity_platform = false
  }

  expect_failures = [
    terraform_data.production_guard,
  ]
}

run "prod_accepts_external_oidc" {
  command = plan

  variables {
    environment    = "prod"
    runtime_mode   = "always_on"
    enable_alloydb = true
    oidc_issuer    = "https://issuer.example.com"
    oidc_audience  = "forgearc-ai"
    oidc_jwks_url  = "https://issuer.example.com/jwks"
  }

  assert {
    condition     = google_cloud_run_v2_job.migrate[0].name == "forgearc-ai-prod-migrate"
    error_message = "Production must create the migration job."
  }

  assert {
    condition     = output.oidc_mode == "external"
    error_message = "Explicit OIDC settings must win over Identity Platform."
  }
}
