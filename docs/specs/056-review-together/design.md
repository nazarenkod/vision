# 056 — Дизайн

## Підхід

- **Сервер** (`backend/src/shared/events/events.gateway.ts`). Сокет уже знає людину й проєкт, за
  яким стежить (032). При вході до нього додається `socket.data.name` — `shortName` з
  `backend/src/shared/events/events-presence.ts` («Olena K.»). Нове повідомлення `presence`
  `{ buildId, testRunId }` приймається лише від сокета в кімнаті свого проєкту й лише для збірки
  цього проєкту (перевірка `build.findFirst`). Після нього і після обриву з'єднання
  (`handleDisconnect`) чи зміни проєкту (`subscribe`) сервер розсилає в кімнату проєкту
  `presence { buildId, viewers }`, де `viewers` — `viewersOf` по `fetchSockets()` кімнати: одна
  людина один раз, на екрані найсвіжішої вкладки. Нічого не зберігається в базі; кілька процесів
  API бачать одне одного через адаптер socket.io, як і решта подій.
- **Клієнт.** `PresenceProvider` (`frontend/src/contexts/presence.context.tsx`) на сторінці збірки
  (`frontend/src/pages/ProjectPage.tsx`) шле `presence` за `buildId` і `testId` з адреси, знову після
  кожного `connect`, і `{}` при виході зі збірки. `PresenceAvatars`
  (`frontend/src/components/PresenceAvatars.tsx`) показує ініціали колег на плитці
  (`frontend/src/components/TestRunList/TestRunGrid.tsx`) і з «теж тут» у шапці порівняння
  (`frontend/src/components/TestDetailsDialog/TestDetailsModal.tsx`); себе не видно
  (`viewersOn`, `frontend/src/_helpers/presence.helper.ts`).

## Ризики

| Ризик | Що робимо |
|---|---|
| Ім'я колеги — персональні дані | лише ім'я й ініціал прізвища, лише тим, хто має доступ до проєкту (042) |
| Шторм розсилок на великій команді | розсилка лише при зміні екрана людини; сотні глядачів — не наш випадок |

## Перевірка вимог

| Вимога | Перевірка |
|---|---|
| REQ-056-01 | `backend/src/shared/events/events.gateway.spec.ts › tells everyone following the project who opened which screen of a build`; `frontend/integration_tests/test/presence.spec.ts › tells which build and screen this tab has open` |
| REQ-056-02 | `backend/src/shared/events/events.gateway.spec.ts › takes a person out of the build when the connection closes` |
| REQ-056-03 | `frontend/integration_tests/test/presence.spec.ts › shows a colleague on the tile and in the comparison, never oneself`; `frontend/src/_helpers/presence.helper.test.ts › shows the colleagues on a screen and never the person looking` |
| REQ-056-04 | `frontend/integration_tests/test/presence.spec.ts › shows a colleague on the tile and in the comparison, never oneself` |
| REQ-056-05 | `backend/src/shared/events/events-presence.spec.ts › names a person by first name and the initial of the last one only`; `backend/src/shared/events/events.gateway.spec.ts › tells everyone following the project who opened which screen of a build` |
| REQ-056-06 | `backend/src/shared/events/events.gateway.spec.ts › ignores a build of another project and a connection that follows none`; `backend/src/shared/events/events-presence.spec.ts › reads what a client opened and nothing else`; `frontend/integration_tests/test/presence.spec.ts › ignores who is in another build` |
| REQ-056-07 | `backend/src/shared/events/events-presence.spec.ts › counts a person with several tabs once, on the screen of the latest` |
| REQ-056-08 | `frontend/src/i18n/translate.test.ts › has every text in both languages…` |
