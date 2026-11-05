import { Page } from "@playwright/test";
import {
  ACCOUNT_BUTTON_TEST_ID,
  ACCOUNT_MENU_ID,
  HELP_MENU_BUTTON_TEST_ID,
  HELP_MENU_ID,
  SIDE_NAV_TEST_ID,
  VERSION_TEST_ID,
} from "~client/components/SideNav.locators";
import { TAKE_TOUR_BUTTON_TEST_ID } from "~client/components/GuidedTour.locators";
import { TourModal } from "./TourModal";

/** The labelled sidebar after sign-in (spec 046). */
export class SideNav {
  nav = this.page.getByTestId(SIDE_NAV_TEST_ID);
  helpMenuButton = this.page.getByTestId(HELP_MENU_BUTTON_TEST_ID);
  helpMenu = this.page.getByTestId(HELP_MENU_ID);
  version = this.page.getByTestId(VERSION_TEST_ID);
  takeTourButton = this.helpMenu.getByTestId(TAKE_TOUR_BUTTON_TEST_ID);
  avatarButton = this.page.getByTestId(ACCOUNT_BUTTON_TEST_ID);
  avatarMenu = this.page.locator(`#${ACCOUNT_MENU_ID}`);
  projectSwitcher = this.page.getByTestId("projectSwitcher");

  constructor(public page: Page) {
    this.page = page;
  }

  async startTour(): Promise<TourModal> {
    await this.helpMenuButton.click();
    await this.takeTourButton.click();

    return new TourModal(this.page);
  }

  async openAvatarMenu() {
    await this.avatarButton.click();
  }

  avatarMenuItem(name: string) {
    return this.avatarMenu.getByRole("menuitem", { name });
  }

  /** an item of the sidebar by its label: Projects, Users, Builds… */
  item(name: string) {
    return this.nav.getByRole("link", { name, exact: true });
  }
}
