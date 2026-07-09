// eslint-disable-next-line unicorn/require-module-specifiers -- marks this a module so `declare global` can augment the UMD `YT` namespace.
export {};

declare global {
  var onYouTubeIframeAPIReady: (() => void) | undefined;
  var umami: {
    track: (eventName: string, eventData?: Record<string, unknown>) => void;
  } | undefined;

  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    umami?: {
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
    };
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
