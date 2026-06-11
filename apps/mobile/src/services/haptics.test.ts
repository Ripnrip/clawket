import * as ExpoHaptics from 'expo-haptics';
import {
  triggerDragEndHaptic,
  triggerDragStartHaptic,
  triggerErrorHaptic,
  triggerLightImpact,
  triggerRigidImpact,
  triggerSelectionHaptic,
  triggerSuccessHaptic,
  triggerWarningHaptic,
} from './haptics';

describe('haptics service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('triggers light impact haptics', () => {
    triggerLightImpact();

    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Light);
  });

  it('triggers rigid impact haptics', () => {
    triggerRigidImpact();

    expect(ExpoHaptics.impactAsync).toHaveBeenCalledWith(ExpoHaptics.ImpactFeedbackStyle.Rigid);
  });

  it('triggers selection haptics', () => {
    triggerSelectionHaptic();

    expect(ExpoHaptics.selectionAsync).toHaveBeenCalled();
  });

  it('uses light impact for drag start and end', () => {
    triggerDragStartHaptic();
    triggerDragEndHaptic();

    expect(ExpoHaptics.impactAsync).toHaveBeenNthCalledWith(1, ExpoHaptics.ImpactFeedbackStyle.Light);
    expect(ExpoHaptics.impactAsync).toHaveBeenNthCalledWith(2, ExpoHaptics.ImpactFeedbackStyle.Light);
  });

  it('triggers success notification haptics', () => {
    triggerSuccessHaptic();

    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Success,
    );
  });

  it('triggers warning notification haptics', () => {
    triggerWarningHaptic();

    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Warning,
    );
  });

  it('triggers error notification haptics', () => {
    triggerErrorHaptic();

    expect(ExpoHaptics.notificationAsync).toHaveBeenCalledWith(
      ExpoHaptics.NotificationFeedbackType.Error,
    );
  });
});
