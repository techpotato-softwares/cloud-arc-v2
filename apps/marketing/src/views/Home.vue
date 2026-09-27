<script setup>
import { ref } from "vue";
import { RouterLink } from "vue-router";
import Icon from "../components/Icon.vue";
import LeadForm from "../components/LeadForm.vue";
import ProductTour from "../components/ProductTour.vue";
import { DOCS_URL } from "../api";

const activeCode = ref("node");

const codeSamples = {
  node: `@Controller({ path: "/api/invoices", lambdaName: "invoices" })
export class InvoiceController {
  @Post("/")
  @RequirePermission("invoice:write")
  create(@Body() input: CreateInvoiceInput) {
    return this.service.create(input);
  }
}`,
  python: `@Controller(path="/api/invoices", lambda_name="invoices")
class InvoiceController:
    @Post("/")
    @RequirePermission("invoice:write")
    def create(self, body: CreateInvoiceInput = Body()):
        return self.service.create(body)`
};

const products = [
  {
    icon: "code",
    name: "ForgeArc Node",
    pill: "Available now",
    text: "A TypeScript backend product with Express locally, Prisma persistence, generated contracts, and AWS CDK.",
    meta: "Node 20 · TypeScript · Prisma · AWS"
  },
  {
    icon: "python",
    name: "ForgeArc Python",
    pill: "Available now",
    text: "A Python backend product with FastAPI, SQLAlchemy, Alembic migrations, and a reproducible uv workflow.",
    meta: "Python 3.12 · FastAPI · uv · AWS"
  },
  {
    icon: "spark",
    name: "ForgeArc AI",
    pill: "Coming next",
    muted: true,
    text: "An AWS-first AI product for Bedrock, retrieval, streaming chat, and queued document ingestion.",
    meta: "Bedrock · RAG · SSE · SQS"
  }
];

const features = [
  { icon: "shield", title: "Identity is already wired", text: "JWT login, refresh, roles, permissions, tenant-aware claims, and route guards are included." },
  { icon: "layers", title: "A structure teams can extend", text: "Controllers, services, repositories, schemas, modules, and infrastructure have explicit boundaries." },
  { icon: "cloud", title: "Infrastructure follows code", text: "A generated manifest drives API Gateway and Lambda, keeping deployment aligned with your routes." },
  { icon: "book", title: "Contracts generate with builds", text: "Route metadata and request schemas produce OpenAPI documents for clients and integrations." },
  { icon: "bolt", title: "Local feedback stays fast", text: "Run the same handlers locally, test modules in isolation, then synthesize and deploy with CDK." },
  { icon: "lock", title: "Delivery remains private", text: "Paid source is delivered as a licensed product artifact with plan-specific setup instructions." }
];

const outcomes = [
  { value: "2", label: "production-ready runtime choices", detail: "Choose Node or Python without changing the architecture." },
  { value: "1", label: "generated API contract", detail: "Manifest and OpenAPI stay part of the build." },
  { value: "0", label: "manual Python environments", detail: "ForgeArc Python is governed end-to-end by uv." },
  { value: "12 mo", label: "included updates", detail: "Keep the source forever; updates are included for one year." }
];

const useCases = [
  { tag: "SaaS teams", title: "Reach paid features sooner", text: "Start with tenant-aware auth, RBAC, storage, deployment, and API contracts instead of rebuilding foundations." },
  { tag: "Agencies", title: "Standardize project delivery", text: "Give engineers one repeatable backend shape across client builds and reduce handover friction." },
  { tag: "Product studios", title: "Validate without throwaway code", text: "Use a production-oriented baseline for an MVP, then extend the same modules as demand grows." }
];

const proof = [
  { title: "Readable before clever", quote: "Every runtime keeps familiar framework conventions, so your team owns the result instead of depending on a black box.", role: "Product principle" },
  { title: "Useful on day one", quote: "Health, authentication, permissions, demo CRUD, files, manifests, OpenAPI, tests, and CDK are present before your first feature.", role: "Included baseline" },
  { title: "Designed for handover", quote: "The buyer receives source, architecture guidance, setup steps, and a deterministic artifact—not access to a hosted dependency.", role: "Delivery promise" }
];

const faqs = [
  { q: "What exactly do I receive?", a: "A licensed source artifact for the product in your plan, its frozen dependency lock, generated contracts, infrastructure code, tests, and a setup guide by email." },
  { q: "Can I use it for client projects?", a: "Single-product and bundle licenses cover your own products. Agency and Enterprise plans cover client work and multiple projects." },
  { q: "Will my application depend on ForgeArc servers?", a: "No. You receive source code and deploy it into infrastructure you control. Checkout and delivery are the only ForgeArc-hosted parts." },
  { q: "How do payments work?", a: "India billing uses Razorpay in rupees. International billing uses Stripe in US dollars. Delivery starts after verified payment confirmation." },
  { q: "Do I get updates?", a: "ForgeArc Node and ForgeArc Python include 12 months of updates. Renewal is optional and your licensed source keeps working." }
];
</script>

<template>
  <main>
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow"><span class="dot"></span>ForgeArc Node and Python are ready to ship</span>
          <h1>Build the product.<br /><span class="gradient-text">Not the backend baseline.</span></h1>
          <p class="lede">
            Own a production-oriented serverless foundation with authentication, modular architecture,
            generated API contracts, tests, and AWS CDK—delivered as source code your team controls.
          </p>
          <div class="actions">
            <RouterLink class="btn btn-brand" to="/pricing">Choose your product <Icon name="arrow" :size="18" /></RouterLink>
            <a class="btn btn-alt" href="#tour"><Icon name="play" :size="17" /> Watch the tour</a>
          </div>
          <div class="trust">
            <span><Icon name="check" :size="16" /> One-time purchase</span>
            <span><Icon name="check" :size="16" /> Source code ownership</span>
            <span><Icon name="check" :size="16" /> 12 months of updates</span>
          </div>
        </div>
        <div class="hero-product" aria-label="ForgeArc product structure preview">
          <div class="hero-product-top">
            <span class="window-dots"><i></i><i></i><i></i></span>
            <span>forgearc-python</span>
            <span class="secure-label"><Icon name="lock" :size="13" /> private</span>
          </div>
          <div class="product-shell">
            <aside class="file-tree">
              <b>PRODUCT</b>
              <span>▾ apps/api</span>
              <span>▾ packages/shared</span>
              <span class="active">▾ modules/platform</span>
              <span>▾ modules/files</span>
              <span>▾ infra/cdk</span>
              <span> migrations</span>
            </aside>
            <div class="shell-content">
              <span class="shell-tab">auth_controller.py</span>
              <pre><span class="t-key">@Controller</span>(<span class="t-ok">"/api/auth"</span>)
class AuthController:
    <span class="t-key">@Post</span>(<span class="t-ok">"/login"</span>)
    <span class="t-key">@ApiPublic</span>()
    def login(self, body):
        return self.service.login(body)</pre>
              <div class="build-result"><Icon name="check" :size="16" /> Manifest, OpenAPI and Lambda routes generated</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="proof-strip">
      <div class="container proof-strip-inner">
        <span>Built for</span>
        <strong>SaaS products</strong><i></i>
        <strong>Client delivery</strong><i></i>
        <strong>Internal platforms</strong><i></i>
        <strong>AI-enabled applications</strong>
      </div>
    </section>

    <section id="products" class="section section-alt">
      <div class="container">
        <div class="section-head" v-reveal>
          <span class="kicker">Choose your runtime</span>
          <h2>One product architecture. Two production stacks.</h2>
          <p>Pick the language your team already knows. The request path, module boundaries, contracts, and deployment model stay consistent.</p>
        </div>
        <div class="grid-3">
          <article v-for="p in products" :key="p.name" class="card product-card" v-reveal>
            <span class="pill" :class="{ 'pill-muted': p.muted }">{{ p.pill }}</span>
            <span class="card-icon"><Icon :name="p.icon" :size="22" /></span>
            <h3>{{ p.name }}</h3>
            <p>{{ p.text }}</p>
            <div class="card-meta">{{ p.meta }}</div>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="outcome-grid">
          <article v-for="item in outcomes" :key="item.label" class="outcome" v-reveal>
            <strong>{{ item.value }}</strong>
            <h3>{{ item.label }}</h3>
            <p>{{ item.detail }}</p>
          </article>
        </div>
      </div>
    </section>

    <section id="tour" class="section section-dark">
      <div class="container tour-grid">
        <div class="tour-copy" v-reveal>
          <span class="kicker">Guided product tour</span>
          <h2>See how a route becomes a deployed capability.</h2>
          <p>Walk through the source layout, request lifecycle, generated contract, and deployment output in under a minute.</p>
          <ul class="check-list">
            <li><Icon name="check" :size="17" /> Product code remains framework-native</li>
            <li><Icon name="check" :size="17" /> Infrastructure reads generated metadata</li>
            <li><Icon name="check" :size="17" /> Buyers deploy into their own AWS account</li>
          </ul>
        </div>
        <ProductTour v-reveal />
      </div>
    </section>

    <section id="code" class="section">
      <div class="container code-grid">
        <div v-reveal>
          <span class="kicker">Your feature code</span>
          <h2>Small surface area. Familiar conventions.</h2>
          <p class="section-copy">
            Define the route and permission where engineers expect to find them. ForgeArc handles
            registration, validation, middleware, contract generation, and deployment wiring.
          </p>
          <div class="code-benefits">
            <span><Icon name="check" :size="16" /> No proprietary DSL</span>
            <span><Icon name="check" :size="16" /> No hosted runtime dependency</span>
            <span><Icon name="check" :size="16" /> No manual API Gateway drift</span>
          </div>
          <a class="text-link" :href="DOCS_URL">Explore the architecture <Icon name="arrow" :size="16" /></a>
        </div>
        <div class="code-window" v-reveal>
          <div class="code-tabs">
            <button :class="{ active: activeCode === 'node' }" @click="activeCode = 'node'">TypeScript</button>
            <button :class="{ active: activeCode === 'python' }" @click="activeCode = 'python'">Python</button>
          </div>
          <pre><code>{{ codeSamples[activeCode] }}</code></pre>
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-head" v-reveal>
          <span class="kicker">What ships with it</span>
          <h2>The production concerns are already connected.</h2>
          <p>Not a collection of snippets—a working product baseline with boundaries your team can continue to own.</p>
        </div>
        <div class="grid-3">
          <article v-for="f in features" :key="f.title" class="card" v-reveal>
            <span class="card-icon"><Icon :name="f.icon" :size="22" /></span>
            <h3>{{ f.title }}</h3>
            <p>{{ f.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head" v-reveal>
          <span class="kicker">Where it creates leverage</span>
          <h2>Useful whether you sell software or deliver it.</h2>
        </div>
        <div class="grid-3">
          <article v-for="item in useCases" :key="item.tag" class="use-case" v-reveal>
            <span>{{ item.tag }}</span>
            <h3>{{ item.title }}</h3>
            <p>{{ item.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-head" v-reveal>
          <span class="kicker">A product you can inspect</span>
          <h2>Proof in the deliverable, not inflated claims.</h2>
          <p>We do not publish invented customer endorsements. These are the concrete promises the source and documentation are built to keep.</p>
        </div>
        <div class="grid-3">
          <article v-for="item in proof" :key="item.title" class="quote-card" v-reveal>
            <Icon name="quote" :size="24" />
            <blockquote>“{{ item.quote }}”</blockquote>
            <strong>{{ item.title }}</strong>
            <span>{{ item.role }}</span>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head" v-reveal>
          <span class="kicker">From payment to production</span>
          <h2>A clear path after checkout.</h2>
        </div>
        <div class="steps">
          <div class="step" v-reveal>
            <h3>Choose and pay securely</h3>
            <p>Use Razorpay in India or Stripe internationally. Your order is fulfilled only after verified payment.</p>
          </div>
          <div class="step" v-reveal>
            <h3>Receive the licensed source</h3>
            <p>Your email includes the plan-specific artifact, license token, frozen lock, and setup order.</p>
          </div>
          <div class="step" v-reveal>
            <h3>Run, inspect, and deploy</h3>
            <p>Start locally, review the generated contract, synthesize CDK, and deploy into infrastructure you own.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container">
        <div class="section-head" v-reveal>
          <span class="kicker">Buying questions</span>
          <h2>Know what you are getting.</h2>
        </div>
        <div class="faq">
          <details v-for="item in faqs" :key="item.q" v-reveal>
            <summary>{{ item.q }}</summary>
            <p>{{ item.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-band" v-reveal>
          <div>
            <span class="kicker kicker-light">Start today</span>
            <h2>Turn your next sprint into product work.</h2>
            <p>Choose ForgeArc Node, ForgeArc Python, or the bundle. Keep the code and deploy it on your terms.</p>
            <div class="actions" style="margin-top: 28px">
              <RouterLink class="btn btn-brand" to="/pricing">Compare plans <Icon name="arrow" :size="18" /></RouterLink>
              <a class="btn btn-ghost-light" :href="DOCS_URL">Read documentation</a>
            </div>
          </div>
          <LeadForm />
        </div>
      </div>
    </section>
  </main>
</template>
