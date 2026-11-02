import { Page } from "@playwright/test";
import { BasePage } from "./BasePage";
import { type Role } from "~client/types";
import { Table } from "./components/Table";

export class UserListPage extends BasePage {
  table: Table;

  constructor(page: Page) {
    super(page);
    this.table = new Table(page);
  }

  async changeRole(userId: string, role: keyof typeof Role) {
    await this.table.getColumn(userId, "role").dblclick();
    await this.page.locator(`[data-value='${role}']`).click();

    return this.page.keyboard.press("Enter");
  }

  async createAccount(account: {
    email: string;
    firstName: string;
    lastName: string;
    role: keyof typeof Role;
    password: string;
  }) {
    await this.page.getByTestId("newUser").click();
    await this.page.getByTestId("newUserEmail").fill(account.email);
    await this.page.getByTestId("newUserFirstName").fill(account.firstName);
    await this.page.getByTestId("newUserLastName").fill(account.lastName);
    await this.page.getByTestId("newUserRole").click();
    await this.page
      .getByRole("option")
      .and(this.page.locator(`[data-value='${account.role}']`))
      .click();
    await this.page.locator("#password").fill(account.password);
    return this.page.getByTestId("submitButton").click();
  }

  async setPassword(userId: string, password: string) {
    await this.table.checkRow(userId);
    await this.page.getByTestId("setPassword").click();
    await this.page.locator("#password").fill(password);
    return this.page.getByTestId("submitButton").click();
  }
}
