# Datasets — demo PDFs

Real, public Indian legal documents for trying out LexClarity's features.
Upload any file below via **Upload PDF** on a tool page (or drag & drop it
into the document box).

All files are official government publications (bare Acts / gazette), freely
shareable public documents. Sources are listed per file so the provenance can
be cited. Every file is text-based (not a scan), under the app's 12&nbsp;MB
upload limit, and verified to extract with the app's own PDF parser.

| File | Source | Pages | Try it with |
| --- | --- | --- | --- |
| `indian-contract-act-1872.pdf` | [India Code](https://www.indiacode.nic.in/bitstream/123456789/2187/2/A187209.pdf) | 53 | **Simplify** — plain-language of ss. 10, 27 · **Ask** — “Can my employer enforce a 12-month non-compete?” |
| `consumer-protection-act-2019.pdf` | [e-Gazette](https://egazette.gov.in/WriteReadData/2019/210422.pdf) | 40 | **Ask** — e-Daakhil, limitation periods · **Action Plan** — steps for a defective-product complaint |
| `dpdp-act-2023.pdf` | [MeitY](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf) | 21 | **Simplify** — consent & breach rules · **Risk X-Ray** — check a SaaS ToS against it |
| `arbitration-and-conciliation-act-1996.pdf` | [India International Arbitration Centre](https://indiaiac.org/arbitrator_docs/acts/1696001047Act_No._26_of_1996_as_updated_on_27.01.2023.pdf) | 47 | **Ask** — ss. 7, 8, 11, 34 questions · **Compare** — arbitration clauses across two contracts |
| `registration-act-1908.pdf` | [Govt. of India (S3WaaS)](https://cdnbbsr.s3waas.gov.in/s3d79c6256b9bdac53a55801a066b70da3/uploads/2020/11/2020112094.pdf) | 86 | **Stamp Duty** page context — s. 17 compulsory registration, s. 49 effect of non-registration · **Ask** — “Is an 11-month rent agreement valid without registration?” |

## Suggested demo flows

1. **Risk X-Ray a rental deal** — load the *Rent Agreement* sample in the app,
   upload `registration-act-1908.pdf` as background, run **Risk X-Ray**, then
   verify charges on the **Stamp Duty** page.
2. **Non-compete clinic** — paste a resignation clause (or the *ToS* sample),
   ask about s. 27 with `indian-contract-act-1872.pdf` attached, then run
   **Playbook** against your positions.
3. **Consumer complaint end-to-end** — upload `consumer-protection-act-2019.pdf`,
   run **Simplify**, then **Action Plan** for the e-Daakhil steps, then build an
   **Advocate Brief** PDF.

## Notes

- Long Acts get trimmed to the app's character budget on upload — the extracted
  text shown in the box is exactly what the analysis uses, so review it first.
- To refresh a file, delete it and re-run the `curl` commands with the source
  URLs above.
