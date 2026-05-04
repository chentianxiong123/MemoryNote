declare module "tinykeys" {
  export function tinykeys(
    target: Window | HTMLElement,
    keyBindings: Record<string, (event: KeyboardEvent) => void>,
    options?: {
      event?: "keydown" | "keyup";
      capture?: boolean;
    }
  ): () => void;
}
