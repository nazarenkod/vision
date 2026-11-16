import { Locator, Page } from "@playwright/test";
import {
  ACCOUNT_BUTTON_TEST_ID,
  ACCOUNT_MENU_ID,
  NEW_PROJECT_TILE_TEST_ID,
  PROJECT_HEADING_TEST_ID,
  PROJECT_RAIL_TEST_ID,
  SIDE_NAV_TEST_ID,
  VERSION_TEST_ID,
} from "~client/components/SideNav.locators";
import { TAKE_TOUR_BUTTON_TEST_ID } from "~client/components/GuidedTour.locators";
import { TourModal } from "./TourModal";

/** The sidebar after sign-in: a rail of projects and the project's sections (spec 060). */
export class SideNav {
  nav: Locator;
  rail: Locator;
  logo: Locator;
  newProjectTile: Locator;
  projectHeading: Locator;
  avatarButton: Locator;
  avatarMenu: Locator;
  version: Locator;
  takeTourButton: Locator;

  // set in the constructor: field initialisers would run before `page` is assigned
  constructor(public page: Page) {
    this.nav = page.getByTestId(SIDE_NAV_TEST_ID);
    this.rail = page.getByTestId(PROJECT_RAIL_TEST_ID);
    this.logo = page.getByTestId("railLogo");
    this.newProjectTile = page.getByTestId(NEW_PROJECT_TILE_TEST_ID);
    this.projectHeading = page.getByTestId(PROJECT_HEADING_TEST_ID);
    this.avatarButton = page.getByTestId(ACCOUNT_BUTTON_TEST_ID);
    this.avatarMenu = page.locator(`#${ACCOUNT_MENU_ID}`);
    this.version = this.avatarMenu.getByTestId(VERSION_TEST_ID);
    this.takeTourButton = this.avatarMenu.getByTestId(TAKE_TOUR_BUTTON_TEST_ID);
  }

  async startTour(): Promise<TourModal> {
    await this.openAvatarMenu();
    await this.takeTourButton.click();

    return new TourModal(this.page);
  }

  async openAvatarMenu() {
    await this.avatarButton.click();
  }

  avatarMenuItem(name: string) {
    return this.avatarMenu.getByRole("menuitem", { name });
  }

  /** a project's tile in the rail, by the project's full name */
  projectTile(name: string) {
    return this.rail.getByRole("link", { name, exact: true });
  }

  /** an item of the sidebar by its label: Builds, Baselines, Users… */
  item(name: string) {
    return this.nav.getByRole("link", { name, exact: true });
  }
}
