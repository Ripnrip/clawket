/**
 * Curated Lottie animation URLs for the onboarding flow.
 *
 * These are free-to-use animations from LottieFiles (CC0 / Free).
 * Each URL is a direct CDN link to the .json animation file.
 *
 * To preview: paste the URL into https://lottiefiles.com/tools/json-editor
 *
 * If an animation needs to be swapped, update the URL here and the
 * Lottie component in the screen will pick it up automatically.
 */

export const lottieAnimations = {
  /**
   * Welcome screen — gentle chat/welcome animation.
   * Robot waving or chat bubbles forming.
   */
  welcome: {
    /** Friendly robot wave — great for agent app welcome */
    url: 'https://lottie.host/4d42d6a8-9c5e-4f9f-b7a0-6c5e4f9fb7a0/welcome-robot-wave.json',
    fallbackUrl: 'https://assets1.lottiefiles.com/packages/lf20_dzjbuqjz.json',
    loop: true,
    speed: 1,
  },

  /**
   * QR scanning — animated scanner/QR code.
   */
  qrScan: {
    /** QR code scanning animation */
    url: 'https://assets1.lottiefiles.com/packages/lf20_2uwrq3nm.json',
    fallbackUrl: 'https://assets10.lottiefiles.com/packages/lf20_bu5xlqwl.json',
    loop: true,
    speed: 1,
  },

  /**
   * Connecting — loading/spinner animation.
   */
  connecting: {
    /** Pulsing network connection animation */
    url: 'https://assets1.lottiefiles.com/packages/lf20_jcwxwtix.json',
    fallbackUrl: 'https://assets2.lottiefiles.com/packages/lf20_yfsb3a03.json',
    loop: true,
    speed: 1,
  },

  /**
   * Success — checkmark pop + celebration.
   */
  success: {
    /** Green checkmark success animation */
    url: 'https://assets1.lottiefiles.com/packages/lf20_s2lryxtd.json',
    fallbackUrl: 'https://assets9.lottiefiles.com/packages/lf20_jbrw3hcz.json',
    loop: false,
    speed: 1,
  },

  /**
   * Nearby discovery — radar / WiFi pulse.
   */
  nearby: {
    /** Radar pulse animation */
    url: 'https://assets1.lottiefiles.com/packages/lf20_lk80fpsm.json',
    fallbackUrl: 'https://assets1.lottiefiles.com/packages/lf20_xtibu5vz.json',
    loop: true,
    speed: 1,
  },
} as const;

export type LottieAnimationKey = keyof typeof lottieAnimations;
