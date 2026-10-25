import { BasePage } from "./BasePage";

export class ProjectListPage extends BasePage {
  // one table row per project (an empty list shows a row without a link)
  projects = this.page
    .locator("#projectlist-1 tbody tr")
    .filter({ has: this.page.getByRole("link") });
  addBtn = this.page.getByRole("button", { name: "add" });
  deleteBtn = this.page.getByTestId("delete");
  editBtn = this.page.getByTestId("EditIcon");

  // ProjectForm, inside the create or update dialog
  dialog = this.modal.dialog;
  name = this.dialog.locator("#name");
  mainBranch = this.dialog.locator("#branchName");
  buildCount = this.dialog.locator("#buildCount");
  maxBranchLifetime = this.dialog.locator("#maxBranchLifetime");
  autoApprove = this.dialog.getByLabel("Auto approve feature");
  imageComparison = this.dialog.getByRole("combobox", {
    name: "Image comparison library",
  });

  project(name: string) {
    return this.projects.filter({
      has: this.page.getByRole("link", { name, exact: true }),
    });
  }

  async selectImageComparison(value: string) {
    await this.imageComparison.click();
    await this.page.getByRole("option", { name: value, exact: true }).click();
  }
}
