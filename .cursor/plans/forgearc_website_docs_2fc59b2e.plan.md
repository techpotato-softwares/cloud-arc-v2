---
name: ForgeArc Website Docs
overview: Rebuild the existing Vue marketing app around the supplied HTML funnel while retaining the current white default theme, adding the HTML’s navy design as dark mode, and keeping Stripe/Razorpay with catalog-authoritative pricing. Expand VitePress into a complete product documentation portal with truthful shipped-vs-roadmap content and locally vendored official architecture icons.
todos:
  - id: align-design-system
    content: Create the shared white-default/navy-dark design system and responsive accessible application shell for marketing and VitePress.
    status: completed
  - id: build-marketing-funnel
    content: Port the HTML-inspired conversion funnel into reusable Vue components with mobile navigation, terminal proof, product tabs, architecture, ROI, FAQ, and CTAs.
    status: completed
  - id: structure-pricing
    content: Normalize catalog pricing into product/module/tier groups and render catalog-backed comparison pricing while preserving Stripe/Razorpay checkout IDs and entitlements.
    status: completed
  - id: expand-product-docs
    content: Build complete Node, Python, AI, architecture, API, deployment, security, troubleshooting, and roadmap documentation in VitePress.
    status: completed
  - id: add-official-diagrams
    content: Vendor approved AWS/GCP icon assets with terms and build responsive labeled architecture diagrams for shipped and roadmap flows.
    status: completed
  - id: seo-analytics-qa
    content: Add truthful SEO/structured data, consent-aware analytics, prerendering, automated checks, and mobile/desktop light/dark launch verification.
    status: completed
isProject: false
---

# ForgeArc Website and Documentation Plan

## Direction and source of truth

- Keep the current Vue/Vite marketing application in [`apps/marketing`](apps/marketing); use [`product-specs/forgearc-website.html`](product-specs/forgearc-website.html) as the visual/funnel reference rather than deploying it separately.
- Preserve the existing ForgeArc logo and brand mark across marketing, documentation, social metadata, navigation, and mobile layouts; only adapt its surrounding spacing and theme-safe presentation.
- Preserve the current white theme as default. Translate the HTML’s navy, blue, green, amber, JetBrains Mono, and Inter system into dark-theme tokens in [`apps/marketing/src/styles.css`](apps/marketing/src/styles.css), with persisted manual selection, correct first-paint theme initialization, and `prefers-reduced-motion` support.
- Keep Stripe for international checkout and Razorpay for India. Keep prices and purchasability authoritative in [`packages/commercial-catalog/catalog.yaml`](packages/commercial-catalog/catalog.yaml); do not copy contradictory HTML/strategy prices or unshipped claims.
- Use product evidence, source previews, architecture proof, and delivery guarantees instead of fabricated testimonials.

## Marketing funnel and mobile experience

- Recompose [`apps/marketing/src/views/Home.vue`](apps/marketing/src/views/Home.vue) into the HTML-inspired funnel: conversion hero and terminal demo, proof/outcome strip, buyer pain, tabbed Node/Python/AI products, architecture layers, three-step workflow, configurable ROI estimator, catalog-backed pricing preview, verifiable proof, FAQ, and final CTA.
- Extract reusable components under `apps/marketing/src/components/`, including `MobileNav.vue`, `HeroTerminal.vue`, `ProofBar.vue`, `ProductTabs.vue`, `ArchitectureLayers.vue`, `ROICalculator.vue`, `PricingMatrix.vue`, and `FinalCta.vue`; retain useful existing components such as consent-based lead capture and verified purchase notifications.
- Upgrade [`apps/marketing/src/App.vue`](apps/marketing/src/App.vue) with a keyboard-accessible full-screen mobile menu, sticky purchase CTA, focus management, escape/route-close behavior, and links to Products, Architecture, Pricing, FAQ, Blog, and Docs.
- Make all sections work at 320px and above using responsive grids, `clamp()` typography, safe-area padding, accessible tap targets, horizontal-overflow protection, and reduced-motion fallbacks.

## Structured product pricing

- Refactor [`packages/commercial-catalog/catalog.yaml`](packages/commercial-catalog/catalog.yaml) into a presentation-ready hierarchy while preserving stable checkout IDs: product family (`node`, `python`, `ai`, `bundle`), module/tier label, billing region prices, availability, recommended flag, feature groups, exclusions, license scope, updates/support, and artifact entitlements.
- Extend [`services/commerce/app/catalog.py`](services/commerce/app/catalog.py) and its tests to expose grouped product/module pricing without duplicating prices in Vue. Keep checkout and entitlement behavior backward compatible.
- Replace the flat card treatment in [`apps/marketing/src/views/Pricing.vue`](apps/marketing/src/views/Pricing.vue) with product tabs, comparable tier/module matrices, clear available/roadmap labeling, INR/USD display, bundle savings derived from catalog data, and Stripe/Razorpay checkout CTAs.

## SEO, trust, and performance

- Update [`apps/marketing/index.html`](apps/marketing/index.html) with canonical URL, accurate title/description, Open Graph/Twitter metadata, catalog-consistent `SoftwareApplication` structured data, theme-color handling for both themes, and `viewport-fit=cover`.
- Add route metadata and static prerendering for `/`, `/pricing`, and key conversion pages so the Vue SPA remains crawlable; add sitemap and robots assets.
- Add privacy-conscious PostHog event hooks behind consent for funnel sections, product/pricing selection, CTA clicks, checkout start, and lead submission; do not collect email/WhatsApp until explicit submission and consent.
- Preserve the existing verified-payment purchase feed. Do not create synthetic purchases or endorsements.

## Complete VitePress product documentation

- Expand [`apps/docs/.vitepress/config.mts`](apps/docs/.vitepress/config.mts) into complete Node, Python, AI, Architecture, API, Security, Deployment, Commercial FAQ, and Roadmap navigation.
- Reconcile stale content such as [`apps/docs/architecture/index.md`](apps/docs/architecture/index.md), and publish deeper content already present under `products/forgearc-node/docs/` and `products/forgearc-python/docs/` without exposing buyer-only artifacts.
- Add focused AI pages under `apps/docs/ai/`: configuration reference, API routes, provider matrix, RAG/ingestion internals, Jev decisions, AWS deployment, security/tenancy/cost controls, operations/troubleshooting, and an explicit shipped-vs-roadmap page for GCP, LangGraph, multi-agent, and evaluation features.
- Add equivalent Node/Python pages for API contracts, DI/request lifecycle, modules, persistence/migrations, generated manifests/OpenAPI, AWS deployment, testing, extension recipes, security, and troubleshooting.
- Keep public documentation technical and truthful; keep plan-gated setup/download artifacts in [`services/commerce/artifacts`](services/commerce/artifacts).

## Official architecture diagrams and shared visual language

- Download the official AWS Architecture Icons and Google Cloud icon packs from vendor sources, retain their terms/readme files, record source version/date in [`apps/docs/architecture/icons.md`](apps/docs/architecture/icons.md), and store only required local assets under `apps/docs/public/icons/{aws,gcp}/`.
- Upgrade [`apps/docs/.vitepress/theme/components/ArchitectureMap.vue`](apps/docs/.vitepress/theme/components/ArchitectureMap.vue) to use official icons plus visible service labels; add a reusable `LayerStack.vue` for the HTML-inspired eight-layer conceptual view.
- Add accurate diagrams for repository/product boundaries, Node request/deploy paths, Python request/data/migration paths, ForgeArc AI chat/RAG/Jev/SQS flows, checkout/entitlement delivery, and AWS/GCP adapter boundaries. Label GCP and advanced agent diagrams as roadmap where they are not shipped.
- Align the VitePress custom theme in [`apps/docs/.vitepress/theme/custom.css`](apps/docs/.vitepress/theme/custom.css) with marketing: white default, matching navy dark mode, shared typography, card/diagram treatment, responsive sidebars, and accessible contrast.

## Verification and launch checks

- Add catalog/commerce tests for grouping, stable checkout IDs, region prices, entitlements, unavailable plans, and bundle calculations.
- Add component and interaction checks for theme persistence, mobile menu, tabs, ROI calculator, pricing selection, keyboard navigation, and reduced motion.
- Run marketing/docs builds, full monorepo lint/type/test/build, link validation, structured-data validation, mobile/desktop browser QA in both themes, Lighthouse accessibility/SEO/performance checks, and visual checks for official icon attribution.
- Verify every public price, availability badge, feature claim, CTA, checkout provider, docs link, and roadmap label against the catalog and shipped products before release.