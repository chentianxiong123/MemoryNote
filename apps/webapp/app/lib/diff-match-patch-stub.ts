// Stub for diff-match-patch
export class diff_match_patch {
  diff_main(a: string, b: string, checklines?: boolean): any[] {
    return [[0, a === b ? a : '']];
  }
  diff_cleanupEfficiency(diffs: any[]): void {}
  diff_toText(diffs: any[]): string {
    return '';
  }
  patch_make(text: string, diffs: any[]): any[] {
    return [];
  }
  patch_apply(patches: any[], text: string): [string, boolean[]] {
    return [text, [true]];
  }
}

export const DIFF_DELETE = -1;
export const DIFF_INSERT = 1;
export const DIFF_EQUAL = 0;

export default diff_match_patch;
