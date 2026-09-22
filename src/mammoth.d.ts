declare module "mammoth" {
  export interface MammothResult {
    readonly value: string;
    readonly messages: readonly unknown[];
  }

  export interface MammothInput {
    readonly buffer?: Buffer;
    readonly arrayBuffer?: ArrayBuffer;
    readonly path?: string;
  }

  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  export function convertToHtml(
    input: MammothInput,
  ): Promise<MammothResult>;
}
