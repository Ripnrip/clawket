// 🎬 AgentActivityWidget — the living portrait on the Lock Screen & Dynamic Island
//
// "A small theatre that plays while the agent toils: a headline, a status
//  whisper, a progress ribbon, and a clock the OS winds on its own."
//
// Member of the WIDGET EXTENSION target only.
import ActivityKit
import SwiftUI
import WidgetKit

@available(iOS 16.2, *)
struct AgentActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AgentActivityAttributes.self) { context in
      // 🖼️ Lock Screen / banner presentation
      VStack(alignment: .leading, spacing: 6) {
        HStack {
          Text(context.attributes.taskTitle)
            .font(.headline)
            .lineLimit(1)
          Spacer()
          Text(startDate(context.state.startedAtMs), style: .timer)
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(maxWidth: 64, alignment: .trailing)
        }
        Text(context.state.status)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(1)
        ProgressView(value: context.state.progress)
          .tint(.accentColor)
      }
      .padding()
      .activityBackgroundTint(Color.black.opacity(0.35))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(context.attributes.taskTitle)
            .font(.caption)
            .lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(startDate(context.state.startedAtMs), style: .timer)
            .font(.caption.monospacedDigit())
            .frame(maxWidth: 64)
        }
        DynamicIslandExpandedRegion(.bottom) {
          ProgressView(value: context.state.progress)
            .tint(.accentColor)
        }
      } compactLeading: {
        Image(systemName: "sparkles")
      } compactTrailing: {
        Text("\(Int(context.state.progress * 100))%")
          .font(.caption2.monospacedDigit())
      } minimal: {
        Image(systemName: "sparkles")
      }
    }
  }

  // 🕰️ Convert epoch-ms (sent from JS) into a Date the timer style can wind.
  private func startDate(_ startedAtMs: Double) -> Date {
    Date(timeIntervalSince1970: startedAtMs / 1000.0)
  }
}
