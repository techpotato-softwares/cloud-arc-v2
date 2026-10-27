locals {
  identity_platform_issuer   = "https://securetoken.google.com/${var.project_id}"
  identity_platform_audience = var.project_id
  identity_platform_jwks_url = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  oidc_issuer = (
    var.oidc_issuer != "" ? var.oidc_issuer :
    var.enable_identity_platform ? local.identity_platform_issuer : ""
  )
  oidc_audience = (
    var.oidc_audience != "" ? var.oidc_audience :
    var.enable_identity_platform ? local.identity_platform_audience : ""
  )
  oidc_jwks_url = (
    var.oidc_jwks_url != "" ? var.oidc_jwks_url :
    var.enable_identity_platform ? local.identity_platform_jwks_url : ""
  )
  production_identity_configured = local.oidc_issuer != "" && local.oidc_audience != "" && local.oidc_jwks_url != ""
}

resource "google_identity_platform_config" "auth" {
  count   = var.enable_identity_platform ? 1 : 0
  project = var.project_id

  sign_in {
    allow_duplicate_emails = false

    email {
      enabled           = true
      password_required = true
    }

    anonymous {
      enabled = false
    }
  }

  authorized_domains = distinct(concat(
    var.identity_platform_authorized_domains,
    [trimsuffix(trimprefix(google_cloud_run_v2_service.api.uri, "https://"), "/")],
  ))

  depends_on = [google_project_service.required]
}
