const summary = document.querySelector("#summary");
const tableWrap = document.querySelector("#table-wrap");
const empty = document.querySelector("#empty");
const errorBox = document.querySelector("#error");
const updated = document.querySelector("#updated");
const overall = document.querySelector("#overall-status");

const labels = {
  total: "CSV files",
  pass: "Passed",
  insufficient: "Insufficient overlap",
  waiting: "Awaiting reference"
};

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function statusLabel(status) {
  return {
    PASS_RAW: "Pass",
    PASS_COMPOSITE: "Pass · composite",
    INSUFFICIENT_OVERLAP: "Insufficient overlap",
    WAITING_FOR_PRODUCER_REFERENCE: "Awaiting reference",
    FAIL: "Fail",
    NOT_PUBLISHED: "Not published",
    ERROR: "Error"
  }[status] || safe(status);
}

function statusClass(status) {
  if (status === "PASS_RAW" || status === "PASS_COMPOSITE") return "pass";
  if (status === "FAIL" || status === "ERROR") return "fail";
  if (status === "INSUFFICIENT_OVERLAP" || status === "WAITING_FOR_PRODUCER_REFERENCE") return "warn";
  return "neutral";
}

function badge(status) {
  const span = document.createElement("span");
  span.className = "badge " + statusClass(status);
  span.textContent = statusLabel(status);
  return span;
}

function card(label, value) {
  const article = document.createElement("article");
  article.className = "card";
  const name = document.createElement("div");
  name.className = "card-label";
  name.textContent = label;
  const number = document.createElement("div");
  number.className = "card-value";
  number.textContent = safe(value, "0");
  article.append(name, number);
  return article;
}

function profileGateText(item, minimum) {
  const counts = item.profile_overlap_counts || {};
  const text = "R1 " + safe(counts.R1, "0") +
    " · R2 " + safe(counts.R2, "0") +
    " · R3 " + safe(counts.R3, "0");
  return minimum ? text + " (minimum " + safe(minimum, "0") + " each)" : text;
}


function render(report) {
  const reports = Array.isArray(report.reports) ? report.reports : [];
  const counts = report.status_counts || {};
  summary.replaceChildren(
    card(labels.total, reports.length),
    card(labels.pass, (counts.PASS_RAW || 0) + (counts.PASS_COMPOSITE || 0)),
    card(labels.insufficient, counts.INSUFFICIENT_OVERLAP || 0),
    card(labels.waiting, counts.WAITING_FOR_PRODUCER_REFERENCE || 0)
  );
  overall.replaceChildren(badge(report.status || "NOT_PUBLISHED"));
  updated.textContent = report.generated_at ? "Generated " + report.generated_at : "No published report yet";

  if (!reports.length) {
    empty.hidden = false;
    tableWrap.replaceChildren();
    return;
  }
  empty.hidden = true;
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Asset", "Timeframe", "CSV", "Disposition", "Raw parity", "Complete shared rows", "Profile gate", "Evidence"].forEach(textValue => {
    const th = document.createElement("th");
    th.textContent = textValue;
    headerRow.append(th);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");

  for (const item of reports) {
    const tr = document.createElement("tr");
    const values = [
      safe(item.asset),
      safe(item.timeframe),
      safe(item.csv),
      statusLabel(item.status),
      item.raw_parity === true ? "Pass" : item.raw_parity === false ? "Fail" : "Not run",
      safe(item.producer_overlap_rows, "0") + " rows",
      profileGateText(item, report.minimum_overlap_rows),
      item.composite_repair_available ? "Composite repair available" :
        item.mismatch_count ? safe(item.mismatch_count) + " mismatches" : "No mismatch evidence"
    ];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      if (index === 3) td.append(badge(item.status));
      else td.textContent = value;
      tr.append(td);
    });
    body.append(tr);
  }
  table.append(head, body);
  tableWrap.replaceChildren(table);
}

async function load() {
  try {
    const response = await fetch("data/report.json?cache=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("Report request returned " + response.status);
    render(await response.json());
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = "The latest report could not be loaded: " + error.message;
    overall.replaceChildren(badge("ERROR"));
  }
}
load();