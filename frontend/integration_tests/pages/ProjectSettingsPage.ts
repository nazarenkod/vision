import { BasePage } from "./BasePage";

export class ProjectSettingsPage extends BasePage {
  heading = this.page.getByRole("heading", { level: 1 });
  saveBtn = this.page.getByTestId("saveSettings");
  unsaved = this.page.getByTestId("unsavedChanges");

  tab(name: string) {
    return this.page.getByTestId(`settingsTab-${name}`);
  }
}
