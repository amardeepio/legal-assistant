import { appendFileSync, readFileSync } from "node:fs";

const SUMMARY_PATH = "coverage/coverage-summary.json";

let total;
try {
  total = JSON.parse(readFileSync(SUMMARY_PATH, "utf8")).total;
} catch {
  console.error(`[coverage] no summary at ${SUMMARY_PATH}; skipping.`);
  process.exit(0);
}

const metrics = ["lines", "statements", "functions", "branches"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let md = "### Test coverage\n\n";
md += "| Metric | Coverage | Covered / Total |\n";
md += "| --- | ---: | ---: |\n";
for (const m of metrics) {
  md += `| ${cap(m)} | ${total[m].pct}% | ${total[m].covered} / ${total[m].total} |\n`;
}
md += "\n";

const out = process.env.GITHUB_STEP_SUMMARY;
if (out) {
  appendFileSync(out, md);
} else {
  process.stdout.write(md);
}
