const crypto = require("crypto");

const ACCENTS = ["American", "British", "Indian", "Australian"];

// Confidence below this threshold gets flagged for human review,
// mirroring the PRD's "boundary cases go to a human reviewer" rule.
const REVIEW_THRESHOLD = 0.65;

// Turns a file's bytes into a stream of pseudo-random floats in [0, 1).
// Deterministic per file so re-analyzing the same upload gives the same
// mock verdict, without needing an actual model in the loop.
function seededRandomStream(seed) {
  let counter = 0;
  return () => {
    const hash = crypto
      .createHash("sha256")
      .update(seed)
      .update(String(counter++))
      .digest();
    return hash.readUInt32BE(0) / 0xffffffff;
  };
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function round(n, places = 4) {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

function riskFromSynthetic(confidence) {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.65) return "medium";
  return "low";
}

function riskFromHuman(confidence) {
  if (confidence < REVIEW_THRESHOLD) return "medium";
  return "low";
}

// Simulates Step 0 (resample/pad/spectrogram) + Step 1 (ResNet18 human vs
// synthetic) + Step 2 (Wav2Vec2 accent head), all mocked, matching the
// PRD's sequential pipeline: accent estimation only runs when Step 1
// says the voice is human.
function runMockPipeline({ buffer, originalName, mimeType }) {
  const seed = crypto.createHash("sha256").update(buffer).update(originalName).digest("hex");
  const rand = seededRandomStream(seed);

  const preprocessing = {
    sampleRateHz: 16000,
    durationSec: 8,
    spectrogramShape: [128, 128],
  };

  // Step 1: synthetic voice detection (mock ResNet18 logit -> probability)
  const syntheticLogit = (rand() - 0.45) * 4; // biased slightly toward "human"
  const pSynthetic = 1 / (1 + Math.exp(-syntheticLogit));
  const isSynthetic = pSynthetic >= 0.5;
  const step1Confidence = round(isSynthetic ? pSynthetic : 1 - pSynthetic);

  const report = {
    fileName: originalName,
    mimeType,
    preprocessing,
    voiceType: isSynthetic ? "synthetic" : "human",
    voiceTypeConfidence: step1Confidence,
    accent: null,
    riskLevel: riskFromSynthetic(step1Confidence),
    needsHumanReview: step1Confidence < REVIEW_THRESHOLD,
    stoppedAfterStep1: isSynthetic,
    modelInfo: {
      syntheticDetector: "ResNet18 (mock)",
      accentEstimator: isSynthetic ? null : "Wav2Vec2-base + linear head (mock)",
    },
  };

  if (isSynthetic) {
    return report;
  }

  // Step 2: accent estimation, only reached for human-classified voices.
  const logits = ACCENTS.map(() => (rand() - 0.5) * 6);
  const probs = softmax(logits);
  const topIdx = probs.indexOf(Math.max(...probs));
  const accentConfidence = round(probs[topIdx]);

  report.accent = {
    predicted: ACCENTS[topIdx],
    confidence: accentConfidence,
    distribution: ACCENTS.reduce((acc, label, i) => {
      acc[label] = round(probs[i]);
      return acc;
    }, {}),
  };
  report.riskLevel = riskFromHuman(accentConfidence);
  report.needsHumanReview = report.needsHumanReview || accentConfidence < REVIEW_THRESHOLD;

  return report;
}

module.exports = { runMockPipeline, ACCENTS };
