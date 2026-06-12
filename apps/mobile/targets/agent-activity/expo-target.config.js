/**
 * 🎯 Apple target config for the AgentActivity widget extension.
 *
 * Consumed by @bacons/apple-targets (added to app.json plugins during the
 * dev-client cycle — see targets/agent-activity/README.md). This declares the
 * widget-extension target that hosts AgentActivityWidget.swift. The Swift files
 * here live OUTSIDE ios/, so `expo prebuild --clean` never wipes them.
 *
 * NOTE: keep the app-group id consistent with the main app's entitlement.
 */
module.exports = (config) => ({
  type: 'widget',
  name: 'AgentActivity',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'ActivityKit', 'WidgetKit'],
  entitlements: {
    'com.apple.security.application-groups': ['group.com.binarybros.clawket'],
  },
});
