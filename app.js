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
  waiting: "Awaiting reference",
  pending: "Products pending"
};

function safe(value, fallback = "—") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function statusLabel(status) {
  return {
    PASS: "Pass",
    PARTIAL: "Partial · pending product",
    PASS_RAW: "Pass",
    PASS_COMPOSITE: "Pass · composite",
    INSUFFICIENT_OVERLAP: "Insufficient overlap",
    WAITING_FOR_PRODUCER_REFERENCE: "Awaiting reference",
    NOT_STARTED: "Not started",
    NOT_PUBLISHED: "Not published",
    FAIL: "Fail",
    ERROR: "Error"
  }[status] || safe(status);
}

function statusClass(status) {
  if (status === "PASS" || status === "PASS_RAW" || status === "PASS_COMPOSITE") return "pass";
  if (status === "FAIL" || status === "ERROR") return "fail";
  if (
    status === "PARTIAL" ||
    status === "INSUFFICIENT_OVERLAP" ||
    status === "WAITING_FOR_PRODUCER_REFERENCE" ||
    status === "NOT_STARTED" ||
    status === "NOT_PUBLISHED"
  ) return "warn";
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
  if (item.product === "CPPO") {
    if (item.csv === "—") return "Awaiting CPPO lane audit";
    const lane = safe(item.lane, "lane").toUpperCase();
    const producer = lane + " " + safe(item.producer_overlap_rows, "0") + " rows";
    const join = " · CORE↔MTF " + safe(item.shared_core_mtf_rows, "0") + " shared";
    return minimum
      ? producer + " (minimum " + safe(minimum, "0") + " independently)" + join
      : producer + join;
  }
  if (item.profile_gate === false) return "No profile gate";
  const counts = item.profile_overlap_counts || {};
  const text = "R1 " + safe(counts.R1, "0") +
    " · R2 " + safe(counts.R2, "0") +
    " · R3 " + safe(counts.R3, "0");
  return minimum ? text + " (minimum " + safe(minimum, "0") + " each)" : text;
}

function productBundles(report) {
  if (Array.isArray(report.products)) return report.products;
  return [{
    product: "SVWAP",
    contract: report.contract,
    status: report.status,
    minimum_overlap_rows: report.minimum_overlap_rows,
    reports: Array.isArray(report.reports) ? report.reports : [],
    status_counts: report.status_counts || {},
    source_commit: report.source_commit
  }];
}

function flattenReports(report) {
  const rows = [];
  for (const product of productBundles(report)) {
    const productReports = Array.isArray(product.reports) ? product.reports : [];
    if (productReports.length) {
      rows.push(...productReports.map(item => ({
        ...item,
        product: product.product,
        contract: product.contract,
        minimum_overlap_rows: product.minimum_overlap_rows,
        source_commit: product.source_commit
      })));
    } else {
      rows.push({
        product: product.product,
        contract: product.contract,
        asset: "—",
        timeframe: product.base_timeframe || "15m",
        csv: "—",
        status: product.status || "NOT_PUBLISHED",
        raw_parity: null,
        producer_overlap_rows: 0,
        profile_gate: false,
        evidence: product.message || "No published audit evidence"
      });
    }
  }
  return rows;
}

function aggregate(report, rows) {
  const counts = {};
  rows.forEach(item => { counts[item.status] = (counts[item.status] || 0) + 1; });
  const bundles = productBundles(report);
  const pending = bundles.filter(item => !["PASS", "PASS_RAW", "PASS_COMPOSITE"].includes(item.status)).length;
  return {
    total: rows.filter(item => item.csv !== "—").length,
    pass: (counts.PASS_RAW || 0) + (counts.PASS_COMPOSITE || 0),
    insufficient: counts.INSUFFICIENT_OVERLAP || 0,
    waiting: counts.WAITING_FOR_PRODUCER_REFERENCE || 0,
    pending,
    counts
  };
}

function render(report) {
  const rows = flattenReports(report);
  const totals = aggregate(report, rows);
  summary.replaceChildren(
    card(labels.total, totals.total),
    card(labels.pass, totals.pass),
    card(labels.insufficient, totals.insufficient),
    card(labels.waiting, totals.waiting),
    card(labels.pending, totals.pending)
  );
  overall.replaceChildren(badge(report.status || "NOT_PUBLISHED"));
  updated.textContent = report.generated_at ? "Generated " + report.generated_at : "No published report yet";

  if (!rows.length) {
    empty.hidden = false;
    tableWrap.replaceChildren();
    return;
  }
  empty.hidden = true;
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Product", "Asset", "Timeframe", "CSV", "Disposition", "Raw parity", "Producer overlap / join", "Contract gate", "Evidence"].forEach(textValue => {
    const th = document.createElement("th");
    th.textContent = textValue;
    headerRow.append(th);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");

  for (const item of rows) {
    const tr = document.createElement("tr");
    const values = [
      safe(item.product),
      safe(item.asset),
      safe(item.timeframe),
      safe(item.csv),
      statusLabel(item.status),
      item.raw_parity === true ? "Pass" : item.raw_parity === false ? "Fail" : "Not run",
      item.product === "CPPO"
        ? safe(item.producer_overlap_rows, "0") + " producer · " + safe(item.shared_core_mtf_rows, "0") + " shared"
        : safe(item.producer_overlap_rows, "0") + " rows",
      profileGateText(item, item.minimum_overlap_rows),
      item.evidence ||
        (item.composite_repair_available ? "Composite repair available" :
        item.mismatch_count ? safe(item.mismatch_count) + " mismatches" : "No mismatch evidence")
    ];
    values.forEach((value, index) => {
      const td = document.createElement("td");
      if (index === 4) td.append(badge(item.status));
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
