import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Lottie from 'lottie-react-native';
import { lottieAnimations, type LottieAnimationKey } from './lottieAssets';

type Props = {
  animationKey: LottieAnimationKey;
  width?: number;
  height?: number;
  color?: string;
  style?: View['props']['style'];
};

/**
 * Reusable Lottie animation wrapper with automatic fallback.
 *
 * Tries the primary URL, falls back to the secondary if it fails.
 * Shows a spinner while loading.
 *
 * Usage:
 * <LottieView animationKey="welcome" width={120} height={120} />
 */
export function LottieAnimationView({ animationKey, width = 120, height = 120, style }: Props): React.JSX.Element {
  const config = lottieAnimations[animationKey];
  const [useFallback, setUseFallback] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const sourceUrl = useFallback ? config.fallbackUrl : config.url;

  const handleError = useCallback(() => {
    if (!useFallback) {
      setUseFallback(true);
    }
  }, [useFallback]);

  useEffect(() => {
    setIsReady(false);
  }, [sourceUrl]);

  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Lottie
        source={{ uri: sourceUrl }}
        autoPlay
        loop={config.loop}
        speed={config.speed}
        resizeMode="contain"
        style={{ width, height }}
        onAnimationFinish={() => setIsReady(true)}
        onError={handleError}
      />
      {!isReady && (
        <View style={{ position: 'absolute' }}>
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}
    </View>
  );
}
