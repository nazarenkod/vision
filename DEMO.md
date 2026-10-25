# Vision demo

Vision is a fork of Visual Regression Tracker with a refreshed UI and these additions:

- **Mobile accessibility.** The Appium page source sent with each screenshot is checked for missing labels, touch targets below 48 dp / 44 pt, low text contrast (measured on the screenshot), inputs without a label, duplicate labels and controls hidden from VoiceOver. Issues are compared with the baseline, so only issues a branch introduces count as new.
- **Jira bugs for accessibility issues.** File a bug from the review screen by naming the task to link it to; screen, device, element, rule and an outlined screenshot are filled in. Issues can be linked to existing bugs or marked as false positives, and both decisions hold for later builds. When a filed issue disappears, the review says the bug can be closed.
- **Change groups.** A build's changes are grouped so one decision covers many screenshots: by identical element change across screens (from the UI tree), or by matching change signature across devices and browsers. Noise (status bar clock, times and amounts, anti-aliasing) is recognised and can be ignored in one click.
- **Precise comparison of mobile screens (from the UI tree).**
  - *Element rules*: ignore an element, or allow N% change inside it, by `id:`, `class:` or `text:` (regex allowed). Pick the element on the screenshot (Changes tab, “Pick element on screenshot”) or use Ignore / Tolerance next to a changed element. On one screen or on every screen of the project. The area follows the element when the layout moves.
  - *System bars* are left out of the comparison (project setting, overridable per screenshot from the SDK).
  - *Moved elements* are compared at their new place (project setting): a banner pushing a list down no longer flags the whole list, while a change inside a moved element still shows.
  - *Hidden changes*: a new label, a disabled or unclickable control, an invisible button on top. The pixels match, but the screenshot goes to review and is never auto-approved.
  - *Taken too early*: a visible spinner, skeleton, shimmer or toast is flagged, and the SDK waits for it to go before the screenshot.
  - *Wrong screen*: a screenshot that looks unlike its baseline (or like another existing screen) is flagged with the screen it resembles.
  - *Component groups*: the same component (toolbar, bottom menu) changed the same way on several screens is one card.
- **Cheap AI (optional).** One call per change group, never per screenshot: text only when the UI tree explains the change, two small crops otherwise, rules first for noise, every answer cached and paid calls capped per day. Also proposes labels for unlabeled icons in the screen's language.

## Run it next to the production VRT

The demo has its own ports, Postgres and image folder and works on a **copy** of production data. Nothing is written back.

```bash
cp .env.demo.example .env.demo
```

In `.env.demo`, set `JWT_SECRET`, the demo URLs, and where production lives: `PROD_PG_CONTAINER` (or `PROD_DATABASE_URL`) and `PROD_IMAGES_DIR`. Then:

```bash
./scripts/demo-clone-from-prod.sh
```

```bash
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d --build
```

The UI is on `DEMO_UI_PORT` (18080 by default), the API on `DEMO_API_PORT` (14200). Production users and API keys work in the copy. The nightly branch cleanup is off in the demo.

Production must run VRT 5.x or later (the script checks this).

## AI settings

| Setting | Value |
|---|---|
| `AI_PROVIDER` | `gemini`, `ollama` or `none` (default) |
| `GEMINI_API_KEY` | key for Gemini |
| `AI_MODEL` | default `gemini-flash-lite-latest` for Gemini, `gemma3:4b` for Ollama |
| `OLLAMA_BASE_URL` | e.g. `http://host.docker.internal:11434` |
| `AI_DAILY_CALL_LIMIT` | paid calls per day, default 500 |

On a Mac Studio (Apple Silicon), Ollama runs on the GPU natively:

```bash
brew install ollama
```

```bash
ollama pull gemma3:4b
```

With `AI_PROVIDER=none` the AI parts of the UI are hidden; accessibility, Jira and change groups work without AI.

## Jira

In project settings: Jira URL and token. Use a personal access token for Server or Data Center. For Jira Cloud, also add the account email and use an API token. The token is never returned by the API. Issue type defaults to Bug, link type to Relates.

## Send UI trees from tests

Java/Kotlin with Appium and Selenide: add `.uiTree(WebDriverRunner.getWebDriver().getPageSource())` to `TestRunOptions` (see `sdk-java/README.md`). It is the SDK's only change and is optional.

Without a device, upload PNG + XML pairs exported from Appium Inspector:

```bash
./scripts/upload-uitree-samples.py samples/ --project "Mobile app" --api http://localhost:14200 --api-key KEY --device "Pixel 7" --density 420
```

## Five-minute demo

1. **Projects** shows the same layout as the other internal tools.
2. Open a build. **Changes** shows, for example, “Button "Pay" → "Send"” on 2 screens as one card. Approve all with one click. The status-bar-only card offers “Ignore status bar”.
3. Open a screenshot. Accessibility issues are numbered on the screen. Click one to zoom to it.
4. **Create Jira bug**: type the parent task and the bug is filed with screen, element and an outlined screenshot. The issue now shows “Bug MOB-…” and no longer counts as new.
5. Mark another issue as a **False positive**. It stops counting in this and every later build.
6. Upload a build where the issue is fixed. The review says the bug can be closed.
7. A component group: “Component id/bottom_nav, changed the same way on 4 screens”. Screens that changed elsewhere too are listed apart.
8. On a screen where a banner pushed the list down, only the banner is flagged; “Compared at their new place” lists the moved elements. Click “Pick element on screenshot”, click the banner, Add rule: the screen joins the component group.
9. A screenshot with a disabled Pay button and identical pixels is in review with “1 hidden”; one taken during loading shows “Loading”; one taken on the wrong screen says which screen it looks like.
10. With AI on: each group gets a one-line explanation and a verdict, and unlabeled icons get a proposed label.

## Changes against upstream

All schema changes are additive (nullable columns, new tables `A11yIssueState` and `AiResult`), so the fork can later run on a live database too. Code is in `backend/`, `frontend/` and `sdk-java/`, imported with `git subtree` from the upstream repositories.
