const CONSENT_KEY = "forgearc-analytics-consent";
const VISITOR_KEY = "forgearc-analytics-id";
const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");

export function analyticsConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

export function setAnalyticsConsent(value) {
  localStorage.setItem(CONSENT_KEY, value ? "accepted" : "declined");
}

function visitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function capture(event, properties = {}) {
  if (!POSTHOG_KEY || analyticsConsent() !== "accepted") return;

  const payload = {
    api_key: POSTHOG_KEY,
    event,
    properties: {
      distinct_id: visitorId(),
      $current_url: window.location.href,
      $pathname: window.location.pathname,
      ...properties
    },
    timestamp: new Date().toISOString()
  };

  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  navigator.sendBeacon(`${POSTHOG_HOST}/capture/`, body);
}

export function trackPageView() {
  capture("$pageview");
}
