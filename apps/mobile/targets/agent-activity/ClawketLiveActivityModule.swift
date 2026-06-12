// 🔌 ClawketLiveActivityModule — the JS↔ActivityKit bridge
//
// "The stagehand who takes cues from the script (JS) and raises, repaints, or
//  lowers the curtain on the living portrait."
//
// Member of the MAIN APP target. Exposes the native module name
// "ClawketLiveActivity" that src/services/live-activities.ts looks up via
// requireOptionalNativeModule. AgentActivityAttributes.swift must also be a
// member of this (app) target.
import ActivityKit
import ExpoModulesCore

public class ClawketLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ClawketLiveActivity")

    // 🚦 Whether the OS currently permits Live Activities (user setting + iOS ≥ 16.2)
    Function("areActivitiesEnabled") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    // 🎭 Raise the curtain — returns the new activity id
    AsyncFunction("start") { (title: String, status: String, progress: Double, startedAtMs: Double) -> String in
      guard #available(iOS 16.2, *) else {
        throw Exception(name: "Unsupported", description: "Live Activities require iOS 16.2+")
      }
      let attributes = AgentActivityAttributes(taskTitle: title)
      let state = AgentActivityAttributes.ContentState(
        status: status,
        progress: progress,
        startedAtMs: startedAtMs
      )
      let activity = try Activity.request(
        attributes: attributes,
        content: .init(state: state, staleDate: nil)
      )
      return activity.id
    }

    // 🖌️ Repaint — update status + progress of a running activity
    AsyncFunction("update") { (id: String, status: String, progress: Double) in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<AgentActivityAttributes>.activities.first(where: { $0.id == id }) else { return }
      let state = AgentActivityAttributes.ContentState(
        status: status,
        progress: progress,
        startedAtMs: activity.content.state.startedAtMs // preserve original start for the timer
      )
      await activity.update(.init(state: state, staleDate: nil))
    }

    // 🌑 Lower the curtain — end immediately
    AsyncFunction("end") { (id: String) in
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<AgentActivityAttributes>.activities.first(where: { $0.id == id }) else { return }
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
