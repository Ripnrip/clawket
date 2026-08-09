/**
 * Curated Lottie animation URLs for the onboarding flow.
 *
 * All animations are free-to-use under the Lottie Simple License.
 * Source pages (for preview/browsing):
 *   QR Scanner:    https://lottiefiles.com/free-animation/qr-code-scanner-3Seud32NMS
 *   Bluetooth:     https://lottiefiles.com/free-animation/bluetooth-connecting-q7EFeU5mbv
 *   External Link: https://lottiefiles.com/free-animation/external-link-iTCy2lF4nB
 *   Checkmark:     https://lottiefiles.com/free-animation/checkmark-animation-mYi6FhyYKA
 *
 * To swap an animation: download the JSON from the LottieFiles page,
 * host it (or use the CDN URL), and update the `url` field here.
 *
 * The `previewUrl` is the LottieFiles page for human browsing — not used at runtime.
 */

export type LottieAnimationConfig = {
  /** Primary CDN URL for the .json animation file */
  url: string;
  /** Fallback CDN URL if primary fails */
  fallbackUrl: string;
  /** LottieFiles page URL for previewing in browser */
  previewUrl: string;
  loop: boolean;
  speed: number;
};

export const lottieAnimations = {
  /**
   * Welcome screen — chat bubble / agent intro.
   * Source: https://lottiefiles.com/free-animation/qr-code-scanner-3Seud32NMS
   */
  welcome: {
    url: 'https://assets1.lottiefiles.com/packages/lf20_dzjbuqjz.json',
    fallbackUrl: 'https://assets2.lottiefiles.com/packages/lf20_yfsb3a03.json',
    previewUrl: 'https://lottiefiles.com/free-animation/checkmark-animation-mYi6FhyYKA',
    loop: true,
    speed: 1,
  },

  /**
   * QR scanning — QR code scanner animation.
   * Source: https://lottiefiles.com/free-animation/qr-code-scanner-3Seud32NMS
   */
  qrScan: {
    url: 'https://assets1.lottiefiles.com/packages/lf20_2uwrq3nm.json',
    fallbackUrl: 'https://assets10.lottiefiles.com/packages/lf20_bu5xlqwl.json',
    previewUrl: 'https://lottiefiles.com/free-animation/qr-code-scanner-3Seud32NMS',
    loop: true,
    speed: 1,
  },

  /**
   * Connecting — bluetooth/network connecting.
   * Source: https://lottiefiles.com/free-animation/bluetooth-connecting-q7EFeU5mbv
   */
  connecting: {
    url: 'https://assets1.lottiefiles.com/packages/lf20_jcwxwtix.json',
    fallbackUrl: 'https://assets2.lottiefiles.com/packages/lf20_yfsb3a03.json',
    previewUrl: 'https://lottiefiles.com/free-animation/bluetooth-connecting-q7EFeU5mbv',
    loop: true,
    speed: 1,
  },

  /**
   * Success — checkmark celebration.
   * Source: https://lottiefiles.com/free-animation/checkmark-animation-mYi6FhyYKA
   */
  success: {
    url: 'https://assets1.lottiefiles.com/packages/lf20_s2lryxtd.json',
    fallbackUrl: 'https://assets9.lottiefiles.com/packages/lf20_jbrw3hcz.json',
    previewUrl: 'https://lottiefiles.com/free-animation/checkmark-animation-mYi6FhyYKA',
    loop: false,
    speed: 1,
  },

  /**
   * Nearby discovery — bluetooth scan / device discovery.
   * Source: https://lottiefiles.com/free-animation/bluetooth-scan-V7RtjXG7jl
   */
  nearby: {
    url: 'https://assets1.lottiefiles.com/packages/lf20_lk80fpsm.json',
    fallbackUrl: 'https://assets1.lottiefiles.com/packages/lf20_xtibu5vz.json',
    previewUrl: 'https://lottiefiles.com/free-animation/bluetooth-scan-V7RtjXG7jl',
    loop: true,
    speed: 1,
  },

  /**
   * Invite/deep link — external link animation.
   * Source: https://lottiefiles.com/free-animation/external-link-iTCy2lF4nB
   */
  deeplink: {
    url: 'https://assets3.lottiefiles.com/packages/lf20_5tkzkblw.json',
    fallbackUrl: 'https://assets1.lottiefiles.com/packages/lf20_xtibu5vz.json',
    previewUrl: 'https://lottiefiles.com/free-animation/external-link-iTCy2lF4nB',
    loop: true,
    speed: 1,
  },
} as const;

export type LottieAnimationKey = keyof typeof lottieAnimations;
