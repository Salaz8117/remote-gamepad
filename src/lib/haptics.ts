import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export type HapticStyle = 'light' | 'medium' | 'heavy';

const STYLE_MAP: Record<HapticStyle, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};

/**
 * Triggers a native haptic feedback event.
 * Falls back to navigator.vibrate for web platforms.
 */
export async function triggerHaptic(style: HapticStyle = 'light') {
  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.impact({ style: STYLE_MAP[style] });
    } catch (e) {
      console.warn('[Haptics] Native impact failed:', e);
    }
  } else {
    // Web fallback: use navigator.vibrate
    // light: 10ms, medium: 20ms, heavy: 50ms
    const durations: Record<HapticStyle, number> = {
      light: 10,
      medium: 20,
      heavy: 50,
    };
    try {
      navigator.vibrate?.(durations[style]);
    } catch (e) {
      console.warn('[Haptics] Web vibrate failed:', e);
    }
  }
}
