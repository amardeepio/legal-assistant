/**
 * pdf.js (loaded through `pdf-parse`) references the DOM global `DOMMatrix`
 * at module-evaluation time (`const SCALE_MATRIX = new DOMMatrix()`).
 *
 * In Node it tries to polyfill that global from the optional native
 * `@napi-rs/canvas` package. That binary is not included in the Next.js
 * standalone / Cloud Run bundle, so the import throws
 * `ReferenceError: DOMMatrix is not defined` and /api/extract-pdf crashes.
 *
 * We only ever extract text (never render), so a lightweight 2D DOMMatrix
 * is enough to let pdf.js load and parse. Call this before importing
 * `pdf-parse`.
 */

interface Matrix2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

class DOMMatrixPolyfill implements Matrix2D {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: readonly number[] | Partial<Matrix2D>) {
    if (Array.isArray(init)) {
      const m = init as readonly number[];
      if (m.length >= 6) {
        this.a = m[0] ?? 1;
        this.b = m[1] ?? 0;
        this.c = m[2] ?? 0;
        this.d = m[3] ?? 1;
        this.e = m[4] ?? 0;
        this.f = m[5] ?? 0;
      }
    } else if (init !== undefined) {
      const m = init as Partial<Matrix2D>;
      this.a = m.a ?? 1;
      this.b = m.b ?? 0;
      this.c = m.c ?? 0;
      this.d = m.d ?? 1;
      this.e = m.e ?? 0;
      this.f = m.f ?? 0;
    }
  }

  private static product(
    m: Matrix2D,
    o: Matrix2D,
  ): [number, number, number, number, number, number] {
    return [
      m.a * o.a + m.c * o.b,
      m.b * o.a + m.d * o.b,
      m.a * o.c + m.c * o.d,
      m.b * o.c + m.d * o.d,
      m.a * o.e + m.c * o.f + m.e,
      m.b * o.e + m.d * o.f + m.f,
    ];
  }

  multiplySelf(other: Matrix2D): this {
    const [a, b, c, d, e, f] = DOMMatrixPolyfill.product(this, other);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  preMultiplySelf(other: Matrix2D): this {
    const [a, b, c, d, e, f] = DOMMatrixPolyfill.product(other, this);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  multiply(other: Matrix2D): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(
      DOMMatrixPolyfill.product(this, other),
    );
  }

  translate(tx = 0, ty = 0): this {
    return this.multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
  }

  scale(sx = 1, sy: number = sx): this {
    return this.multiplySelf({ a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 });
  }

  invertSelf(): this {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) {
      this.a = 0;
      this.b = 0;
      this.c = 0;
      this.d = 0;
      this.e = 0;
      this.f = 0;
      return this;
    }
    const [a, b, c, d, e, f] = [
      this.d / det,
      -this.b / det,
      -this.c / det,
      this.a / det,
      (this.c * this.f - this.d * this.e) / det,
      (this.b * this.e - this.a * this.f) / det,
    ];
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
    return this;
  }

  inverse(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill({ ...this }).invertSelf();
  }
}

export function ensurePdfJsDomPolyfills(): void {
  const g = globalThis as Record<string, unknown>;
  if (g["DOMMatrix"] === undefined) {
    g["DOMMatrix"] = DOMMatrixPolyfill;
  }
}
