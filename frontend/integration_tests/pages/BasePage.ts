import { Page } from "@playwright/test";
import { SideNav } from "./SideNav";
import { Modal } from "./Modal";
import { Notification } from "./Notification";

export abstract class BasePage {
  sideNav: SideNav;
  modal: Modal;
  notification: Notification;

  constructor(public page: Page) {
    this.page = page;
    this.sideNav = new SideNav(page);
    this.modal = new Modal(page);
    this.notification = new Notification(page);
  }
}
