import FamilyControls
import SwiftUI

struct ActivityPickerSheet: View {
  @State private var selection: FamilyActivitySelection
  private let onFinish: (FamilyActivitySelection?) -> Void

  init(initial: FamilyActivitySelection, onFinish: @escaping (FamilyActivitySelection?) -> Void) {
    _selection = State(initialValue: initial)
    self.onFinish = onFinish
  }

  private var isEmpty: Bool {
    selection.applicationTokens.isEmpty && selection.categoryTokens.isEmpty && selection.webDomainTokens.isEmpty
  }

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Choose apps and sites")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel") { onFinish(nil) }
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { onFinish(selection) }.disabled(isEmpty)
          }
        }
    }
  }
}
