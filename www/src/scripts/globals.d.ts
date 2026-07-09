// eslint-disable-next-line unicorn/require-module-specifiers -- marks this a module so `declare global` can augment the UMD `YT` namespace.
export {};

declare global {
  var onYouTubeIframeAPIReady: (() => void) | undefined;

  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }

  // `@types/youtube` omits the (undocumented) module option methods. Augment
  // them in.
  namespace YT {
    interface Player {
      getOptions: () => string[];
      setOption: (module: string, option: string, value: unknown) => void;
    }
  }
}
