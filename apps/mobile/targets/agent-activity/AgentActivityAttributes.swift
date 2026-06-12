// 🎭 AgentActivityAttributes — the shared contract between app and widget
//
// "The script both stage and storyteller read from — what stays fixed for the
//  whole performance (the title) and what shifts scene to scene (status,
//  progress, the ticking clock)."
//
// This file MUST be a member of BOTH the main app target and the widget
// extension target so Swift can encode/decode the same shape on each side.
import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct AgentActivityAttributes: ActivityAttributes {
  // 🌟 Dynamic state — pushed from JS on every update().
  public struct ContentState: Codable, Hashable {
    var status: String     // e.g. "Running", "Tool: bash", "Finishing"
    var progress: Double    // 0.0...1.0
    var startedAtMs: Double // epoch ms; the OS renders the live elapsed timer
  }

  // 🪧 Static — set once at start(), never changes for this activity.
  var taskTitle: String
}
