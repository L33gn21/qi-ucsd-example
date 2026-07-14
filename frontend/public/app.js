const API_BASE = window.API_BASE !== undefined && window.API_BASE !== ""
  ? window.API_BASE
  : (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:4000"
      : "");

const dropzone = document.getElementById("dropzone");
const audioInput = document.getElementById("audioInput");
const fileInfo = document.getElementById("fileInfo");
const analyzeBtn = document.getElementById("analyzeBtn");
const errorMsg = document.getElementById("errorMsg");
const pipelineSection = document.getElementById("pipeline");
const reportSection = document.getElementById("report");

let selectedFile = null;

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.toggle("hidden", !message);
}

function selectFile(file) {
  if (!file) return;
  if (!file.type.startsWith("audio/")) {
    showError("오디오 파일만 업로드할 수 있습니다.");
    return;
  }
  selectedFile = file;
  showError("");
  fileInfo.textContent = `${file.name} · ${formatBytes(file.size)}`;
  fileInfo.classList.remove("hidden");
  analyzeBtn.disabled = false;
  pipelineSection.classList.add("hidden");
  reportSection.classList.add("hidden");
}

dropzone.addEventListener("click", () => audioInput.click());
audioInput.addEventListener("change", (e) => selectFile(e.target.files[0]));

["dragover", "dragenter"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  selectFile(file);
});

function setStepState(id, state, statusText) {
  const el = document.getElementById(id);
  el.classList.remove("active", "done", "skipped");
  if (state) el.classList.add(state);
  el.querySelector(".step-status").textContent = statusText || "";
}

function resetSteps() {
  ["step-0", "step-1", "step-2", "step-3"].forEach((id) => setStepState(id, null, ""));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function animatePipeline(report) {
  resetSteps();
  pipelineSection.classList.remove("hidden");

  setStepState("step-0", "active", "처리 중...");
  await wait(350);
  setStepState("step-0", "done", `완료 · 16kHz / 8초 / ${report.preprocessing.spectrogramShape.join("x")}`);

  setStepState("step-1", "active", "처리 중...");
  await wait(450);
  const voiceLabelKo = report.voiceType === "human" ? "사람 음성" : "합성음";
  setStepState("step-1", "done", `완료 · ${voiceLabelKo} (${Math.round(report.voiceTypeConfidence * 100)}%)`);

  if (report.stoppedAfterStep1) {
    setStepState("step-2", "skipped", "건너뜀 · 합성음이므로 억양 추정 생략");
  } else {
    setStepState("step-2", "active", "처리 중...");
    await wait(450);
    setStepState("step-2", "done", `완료 · ${report.accent.predicted} (${Math.round(report.accent.confidence * 100)}%)`);
  }

  setStepState("step-3", "active", "리포트 생성 중...");
  await wait(250);
  setStepState("step-3", "done", "완료");
}

function renderReport(report) {
  const verdictBadge = document.getElementById("verdictBadge");
  verdictBadge.textContent = report.voiceType === "human" ? "사람 음성" : "합성음 (AI 생성)";
  verdictBadge.className = `verdict-badge ${report.voiceType}`;

  document.getElementById("voiceConfidenceFill").style.width = `${report.voiceTypeConfidence * 100}%`;
  document.getElementById("voiceConfidenceLabel").textContent = `${Math.round(report.voiceTypeConfidence * 100)}%`;

  const riskBadge = document.getElementById("riskBadge");
  const riskKo = { low: "낮음", medium: "중간", high: "높음" }[report.riskLevel];
  riskBadge.textContent = riskKo;
  riskBadge.className = `risk-badge ${report.riskLevel}`;

  document.getElementById("reviewFlag").classList.toggle("hidden", !report.needsHumanReview);

  const accentCard = document.getElementById("accentCard");
  if (report.accent) {
    accentCard.classList.remove("hidden");
    document.getElementById("accentPredicted").textContent =
      `${report.accent.predicted} 억양 (신뢰도 ${Math.round(report.accent.confidence * 100)}%)`;

    const dist = document.getElementById("accentDistribution");
    dist.innerHTML = "";
    Object.entries(report.accent.distribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([label, prob]) => {
        const row = document.createElement("div");
        row.className = "accent-row";
        row.innerHTML = `
          <span class="label">${label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${prob * 100}%"></div></div>
          <span class="pct">${Math.round(prob * 100)}%</span>
        `;
        dist.appendChild(row);
      });
  } else {
    accentCard.classList.add("hidden");
  }

  const metaList = document.getElementById("metaList");
  metaList.innerHTML = "";
  const metaEntries = [
    ["파일명", report.fileName],
    ["파일 크기", formatBytes(report.fileSizeBytes)],
    ["추론 지연시간", `${report.latencyMs} ms`],
    ["분석 시각", new Date(report.analyzedAt).toLocaleString("ko-KR")],
    ["합성음 탐지 모델", report.modelInfo.syntheticDetector],
    ["억양 추정 모델", report.modelInfo.accentEstimator || "미실행"],
  ];
  metaEntries.forEach(([k, v]) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${k}:</strong> ${v}`;
    metaList.appendChild(li);
  });

  reportSection.classList.remove("hidden");
}

const historyBody = document.getElementById("historyBody");
const historyEmpty = document.getElementById("historyEmpty");

function renderHistory(items) {
  historyBody.innerHTML = "";
  historyEmpty.classList.toggle("hidden", items.length > 0);
  const riskKo = { low: "낮음", medium: "중간", high: "높음" };
  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${new Date(item.analyzed_at).toLocaleString("ko-KR")}</td>
      <td>${item.file_name}</td>
      <td>${item.voice_type === "human" ? "사람 음성" : "합성음"}</td>
      <td>${Math.round(item.voice_type_confidence * 100)}%</td>
      <td>${item.accent || "-"}</td>
      <td><span class="risk-badge ${item.risk_level}">${riskKo[item.risk_level]}</span></td>
      <td>${item.needs_human_review ? "⚠" : ""}</td>
    `;
    historyBody.appendChild(tr);
  });
}

async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/api/history`);
    if (!res.ok) return;
    const { items } = await res.json();
    renderHistory(items);
  } catch (err) {
    // history is best-effort; ignore failures silently
  }
}

loadHistory();

analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  showError("");
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "분석 중...";
  reportSection.classList.add("hidden");

  const formData = new FormData();
  formData.append("audio", selectedFile);

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `서버 오류 (${res.status})`);
    }
    const report = await res.json();
    await animatePipeline(report);
    renderReport(report);
    loadHistory();
  } catch (err) {
    showError(err.message || "분석 중 오류가 발생했습니다.");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "분석 시작";
  }
});
