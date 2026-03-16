const output       = document.getElementById("output");
const badge        = document.getElementById("statusBadge");
const summarizeBtn = document.getElementById("summarizeBtn");
const inputText    = document.getElementById("inputText");
const typeSelect   = document.getElementById("typeSelect");
const lengthSelect = document.getElementById("lengthSelect");

function setStatus(text, level) {
  badge.textContent = text;
  badge.className   = "badge" + (level ? " " + level : "");
}

// ── Resolve the Summarizer API (handles multiple Chrome versions) ──
function getSummarizerAPI() {
  // Chrome 136+: standalone global
  if (typeof Summarizer !== "undefined") return Summarizer;
  // Chrome 131–135: under self.ai / window.ai
  if (typeof self !== "undefined" && self.ai?.summarizer) return self.ai.summarizer;
  if (typeof window !== "undefined" && window.ai?.summarizer) return window.ai.summarizer;
  return null;
}

// ── Check availability ─────────────────────────────────────────────
async function checkAvailability() {
  // Diagnostic: log what the browser exposes so the user can inspect in DevTools
  console.log("typeof Summarizer :", typeof Summarizer);
  console.log("self.ai           :", typeof self !== "undefined" ? self.ai : "N/A");
  console.log("window.ai         :", typeof window !== "undefined" ? window.ai : "N/A");

  const api = getSummarizerAPI();

  if (!api) {
    setStatus("Summarizer API not found", "err");
    output.textContent =
      "No Summarizer API detected.\n\n" +
      "Diagnostics (also in DevTools console):\n" +
      "  typeof Summarizer  = " + (typeof Summarizer) + "\n" +
      "  self.ai            = " + (typeof self !== "undefined" ? JSON.stringify(self.ai) : "N/A") + "\n" +
      "  window.ai          = " + (typeof window !== "undefined" ? JSON.stringify(window.ai) : "N/A") + "\n\n" +
      "Steps to enable:\n" +
      " 1. Use Chrome 131+ (Dev / Canary recommended)\n" +
      " 2. Enable:  chrome://flags/#summarization-api-for-gemini-nano\n" +
      " 3. Also enable:  chrome://flags/#optimization-guide-on-device-model\n" +
      " 4. Go to chrome://components → 'Optimization Guide On Device Model' → Check for update\n" +
      " 5. Restart Chrome and reload this page";
    return;
  }

  // Chrome 136+: Summarizer.availability() → string
  // Chrome 131-135: self.ai.summarizer.capabilities() → { available: string }
  let status;
  if (typeof api.availability === "function") {
    status = await api.availability();
    console.log("Summarizer.availability():", status);
  } else if (typeof api.capabilities === "function") {
    const caps = await api.capabilities();
    console.log("Summarizer capabilities:", caps);
    status = caps.available;
  } else {
    // No way to check – just try to create directly
    console.log("No availability/capabilities method – will attempt create.");
    status = "available";
  }

  // Normalise: old API used "readily"/"after-download"/"no"
  //            new API uses "available"/"downloadable"/"downloading"/"unavailable"
  const unavailable = ["no", "unavailable"];
  const downloading = ["after-download", "downloadable", "downloading"];
  const ready       = ["readily", "available"];

  if (unavailable.includes(status)) {
    setStatus("Model not available", "warn");
    output.textContent =
      "The Summarizer API exists but the on-device model is not ready.\n" +
      "Go to chrome://components → 'Optimization Guide On Device Model' → Check for update.\n" +
      "Then restart Chrome.";
    return;
  }

  if (downloading.includes(status)) {
    setStatus("Downloading model…", "warn");
    output.textContent = "The model is being downloaded. This may take a few minutes.\nTry again shortly.";
    summarizeBtn.disabled = false;
    return;
  }

  setStatus("Ready ✓", "");
  summarizeBtn.disabled = false;
  output.textContent = "Paste some text and click Summarize.";
}

// ── Summarize ──────────────────────────────────────────────────────
summarizeBtn.addEventListener("click", async () => {
  const text = inputText.value.trim();
  if (!text) {
    output.textContent = "Please enter some text first.";
    return;
  }

  const api = getSummarizerAPI();
  if (!api) {
    output.textContent = "Summarizer API is no longer available. Reload the page.";
    return;
  }

  summarizeBtn.disabled = true;
  output.textContent = "Summarizing…";

  try {
    const options = {
      type:   typeSelect.value,
      length: lengthSelect.value,
    };

    const session = await api.create(options);
    const result  = await session.summarize(text);

    output.textContent = result;
    session.destroy();
  } catch (err) {
    console.error("Summarization error:", err);
    output.textContent = "Error: " + err.message;
  } finally {
    summarizeBtn.disabled = false;
  }
});

// Run on load
checkAvailability();
