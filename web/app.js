// Shared helpers for the partner pages. No framework, no tracking.
window.beseen = {
  token() {
    return new URLSearchParams(location.search).get("t") || "";
  },

  async call(route, body, query = "") {
    const res = await fetch(`${window.BESEEN_API_URL}/${route}${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
    return data;
  },

  show(id) {
    document.querySelectorAll("[data-step]").forEach((el) => (el.hidden = el.id !== id));
  },

  fail(message) {
    document.getElementById("error-text").textContent = message;
    this.show("error");
  },

  fill(selector, text) {
    document.querySelectorAll(selector).forEach((el) => (el.textContent = text));
  },
};
