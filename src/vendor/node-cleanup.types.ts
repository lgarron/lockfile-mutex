declare module "node-cleanup" {
  export default function nodeCleanup(
    handlerFn: (exitCode: number, signal: string) => void,
  ): void;
}
