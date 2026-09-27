import { defineConfig } from "vitepress";

export default defineConfig({
  title: "ForgeArc",
  description: "Production-ready cloud and AI application kits",
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: "https://docs.forgearc.dev" },
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "ForgeArc Docs",
    nav: [
      { text: "ForgeArc Node", link: "/node/" },
      { text: "ForgeArc Python", link: "/python/" },
      { text: "ForgeArc AI", link: "/ai/" },
      { text: "Architecture", link: "/architecture/" }
    ],
    sidebar: {
      "/node/": [
        {
          text: "ForgeArc Node",
          items: [
            { text: "Overview", link: "/node/" },
            { text: "Getting started", link: "/node/getting-started" },
            { text: "Architecture", link: "/node/architecture" },
            { text: "Modules", link: "/node/modules" }
          ]
        },
        {
          text: "Shared",
          items: [
            { text: "Request path", link: "/architecture/request-path" },
            { text: "Deploy", link: "/architecture/deploy" },
            { text: "Security", link: "/architecture/security" }
          ]
        }
      ],
      "/python/": [
        {
          text: "ForgeArc Python",
          items: [
            { text: "Overview", link: "/python/" },
            { text: "Getting started", link: "/python/getting-started" },
            { text: "Architecture", link: "/python/architecture" },
            { text: "Modules and data", link: "/python/modules" }
          ]
        },
        {
          text: "Shared",
          items: [
            { text: "Request path", link: "/architecture/request-path" },
            { text: "Deploy", link: "/architecture/deploy" },
            { text: "Security", link: "/architecture/security" }
          ]
        }
      ],
      "/ai/": [
        {
          text: "ForgeArc AI",
          items: [
            { text: "Overview", link: "/ai/" },
            { text: "Planned quickstart", link: "/ai/quickstart" },
            { text: "AWS and GCP", link: "/ai/aws-architecture" },
            { text: "Chat and ingest flows", link: "/ai/flows" }
          ]
        }
      ],
      "/architecture/": [
        {
          text: "Architecture",
          items: [
            { text: "Product map", link: "/architecture/" },
            { text: "Request path", link: "/architecture/request-path" },
            { text: "Modules", link: "/architecture/modules" },
            { text: "Deploy", link: "/architecture/deploy" },
            { text: "Security", link: "/architecture/security" },
            { text: "Icon policy", link: "/architecture/icons" }
          ]
        }
      ]
    },
    socialLinks: [{ icon: "github", link: "https://github.com/thinkincloud" }],
    search: { provider: "local" },
    footer: {
      message: "Built by TechPotato Softwares LLP",
      copyright: "Copyright © 2026 ForgeArc"
    }
  },
  markdown: {
    theme: { light: "github-light", dark: "github-dark" }
  },
  head: [
    ["meta", { name: "theme-color", content: "#9a3412" }],
    ["link", { rel: "icon", href: "/logo.svg" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Source+Serif+4:opsz,wght@8..60,560;8..60,680&display=swap"
      }
    ]
  ]
});
