import { beforeEach, describe, expect, it, vi } from "vitest";

const getTextMock = vi.hoisted(() => vi.fn());
const destroyMock = vi.hoisted(() => vi.fn());
const extractRawTextMock = vi.hoisted(() => vi.fn());

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    constructor(_options: unknown) {
      void _options;
    }
    getText = getTextMock;
    destroy = destroyMock;
  },
}));

vi.mock("mammoth", () => ({
  default: { extractRawText: extractRawTextMock },
}));

import { POST } from "@/app/api/extract-pdf/route";
import { resetRateLimits } from "@/lib/rate-limit";

function postFile(file: File | null): Request {
  const form = new FormData();
  if (file !== null) form.append("file", file);
  return new Request("http://localhost/api/extract-pdf", {
    method: "POST",
    body: form,
  });
}

const pdf = (parts: BlobPart[], name = "a.pdf"): File =>
  new File(parts, name, { type: "application/pdf" });

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const docx = (parts: BlobPart[], name = "agreement.docx"): File =>
  new File(parts, name, { type: DOCX_MIME });

describe("POST /api/extract-pdf", () => {
  beforeEach(() => {
    getTextMock.mockReset();
    destroyMock.mockReset();
    destroyMock.mockResolvedValue(undefined);
    extractRawTextMock.mockReset();
    resetRateLimits();
  });

  it("rejects missing files with 400", async () => {
    const res = await POST(postFile(null));
    expect(res.status).toBe(400);
  });

  it("rejects non-PDF/non-docx uploads with 415", async () => {
    const res = await POST(
      postFile(new File(["hello"], "a.txt", { type: "text/plain" })),
    );
    expect(res.status).toBe(415);
  });

  it("rejects legacy .doc uploads with 415", async () => {
    const res = await POST(
      postFile(new File(["binary"], "old.doc", { type: "application/msword" })),
    );
    expect(res.status).toBe(415);
  });

  it("rejects empty PDFs with 400", async () => {
    const res = await POST(postFile(pdf([])));
    expect(res.status).toBe(400);
  });

  it("rejects oversized PDFs with 413", async () => {
    const big = new Uint8Array(13 * 1024 * 1024);
    const res = await POST(postFile(pdf([big], "big.pdf")));
    expect(res.status).toBe(413);
  });

  it("rejects scanned PDFs with no text (422)", async () => {
    getTextMock.mockResolvedValueOnce({ text: "   \n  ", total: 3 });
    const res = await POST(postFile(pdf(["%PDF-bytes"])));
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(String(body["error"])).toMatch(/scanned/i);
  });

  it("returns normalised text on success", async () => {
    getTextMock.mockResolvedValueOnce({
      text: "Hello\n\n-- 1 of 2 --\n\nWorld",
      total: 2,
    });
    const res = await POST(postFile(pdf(["%PDF-bytes"], "deed.pdf")));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      text: string;
      pages: number | null;
      fileName: string;
      truncated: boolean;
    };
    expect(body.text).toBe("Hello\n\nWorld");
    expect(body.pages).toBe(2);
    expect(body.fileName).toBe("deed.pdf");
    expect(body.truncated).toBe(false);
    expect(destroyMock).toHaveBeenCalled();
  });

  it("extracts .docx text with null pages", async () => {
    extractRawTextMock.mockResolvedValueOnce({
      value: "Clause 1. Payment\n\nClause 2. Term",
      messages: [],
    });
    const res = await POST(postFile(docx(["%DOCX-bytes"])));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      text: string;
      pages: number | null;
      fileName: string;
      truncated: boolean;
    };
    expect(body.text).toContain("Clause 1. Payment");
    expect(body.pages).toBeNull();
    expect(body.fileName).toBe("agreement.docx");
    expect(getTextMock).not.toHaveBeenCalled();
  });

  it("rejects empty .docx files with 422", async () => {
    extractRawTextMock.mockResolvedValueOnce({ value: "   \n  ", messages: [] });
    const res = await POST(postFile(docx(["%DOCX-bytes"])));
    expect(res.status).toBe(422);
  });

  it("rejects oversized .docx files with 413", async () => {
    const big = new Uint8Array(13 * 1024 * 1024);
    const res = await POST(postFile(docx([big], "big.docx")));
    expect(res.status).toBe(413);
    expect(extractRawTextMock).not.toHaveBeenCalled();
  });

  it("maps .docx parser crashes to 422", async () => {
    extractRawTextMock.mockRejectedValueOnce(new Error("bad zip"));
    const res = await POST(postFile(docx(["%DOCX-bytes"])));
    expect(res.status).toBe(422);
  });

  it("maps parser crashes to 422", async () => {
    getTextMock.mockRejectedValueOnce(new Error("corrupt xref"));
    const res = await POST(postFile(pdf(["%PDF-bytes"])));
    expect(res.status).toBe(422);
  });

  it("returns 429 with Retry-After past the per-minute budget", async () => {
    getTextMock.mockResolvedValue({ text: "Hello world", total: 1 });
    for (let i = 0; i < 20; i += 1) {
      expect((await POST(postFile(pdf(["%PDF-bytes"])))).status).toBe(200);
    }
    const blocked = await POST(postFile(pdf(["%PDF-bytes"])));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
  });
});
