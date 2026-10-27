import { BasePage } from "./BasePage";

export class ProjectListPage extends BasePage {
  // one table row per project (an empty list shows a row without a link)
  projects = this.page
    .locator("#projectlist-1 tbody tr")
    .filter({ has: this.page.getByRole("link") });
  addBtn = this.page.getByRole("button", { name: "add" });
  deleteBtn = this.page.getByTestId("delete");
  editBtn = this.page.getByTestId("EditIcon");

  // the create dialog asks only for these; the rest is on the settings page
  dialog = this.modal.dialog;
  name = this.dialog.locator("#name");
  mainBranch = this.dialog.locator("#branchName");

  project(name: string) {
    return this.projects.filter({
      has: this.page.getByRole("link", { name, exact: true }),
    });
  }
}
