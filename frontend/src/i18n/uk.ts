import { Messages } from "./en";

/** Тексти інтерфейсу українською: тип Messages вимагає кожен ключ en.ts (ADR-0014). */
export const uk: Messages = {
  "language.label": "Мова інтерфейсу",

  "common.cancel": "Скасувати",
  "common.delete": "Видалити",
  "common.remove": "Прибрати",
  "common.dismissNotification": "Закрити сповіщення",

  "header.home": "{brand}: головна",
  "header.help": "Довідка",
  "header.account": "Обліковий запис",
  "header.manualChecks": "Ручні перевірки (CLI)",
  "header.reportProblem": "Повідомити про проблему",
  "header.users": "Користувачі",
  "header.backups": "Бекапи",
  "header.projects": "Проєкти",
  "header.profile": "Профіль",
  "header.logout": "Вийти",

  "nav.main": "Головне меню",
  "nav.projects": "Проєкти",
  "nav.builds": "Білди",
  "nav.baselines": "Еталони",
  "nav.insights": "Insights",
  "nav.settings": "Налаштування проєкту",
  "nav.users": "Користувачі",
  "nav.profile": "Профіль",

  "projectList.title": "Проєкти",
  "projectList.search": "Пошук",
  "projectList.searchPlaceholder": "Назва проєкту",
  "projectList.add": "Додати проєкт",
  "projectList.project": "Проєкт",
  "projectList.mainBranch": "Основна гілка",
  "projectList.comparison": "Порівняння",
  "projectList.created": "Створено",
  "projectList.actions": "Дії",
  "projectList.jiraConnected": "Підключено",
  "projectList.jiraNotSet": "Не налаштовано",
  "projectList.builds": "Білди",
  "projectList.baselines": "Еталони",
  "projectList.settings": "Налаштування",
  "projectList.settingsOf": "Налаштування {name}",
  "projectList.deleteOf": "Видалити {name}",
  "projectList.noMatch": "Немає проєктів, що містять «{search}»",
  "projectList.empty": "Проєктів ще немає",
  "projectList.createTitle": "Новий проєкт",
  "projectList.create": "Створити",
  "projectList.createHint":
    "Решта налаштувань отримає типові значення; далі відкриється сторінка налаштувань проєкту.",
  "projectList.createdToast": "Проєкт {name} створено",
  "projectList.deleteTitle": "Видалити проєкт",
  "projectList.deleteConfirm": "Точно видалити проєкт {name}?",
  "projectList.deletedToast": "Проєкт {name} видалено",

  "settings.title": "Налаштування проєкту",
  "settings.backToProjects": "Проєкти",
  "settings.tab.general": "Загальне",
  "settings.tab.comparison": "Порівняння зображень",
  "settings.tab.mobile": "Мобільні (UI-дерево)",
  "settings.tab.accessibility": "Доступність",
  "settings.tab.jira": "Jira",
  "settings.save": "Зберегти",
  "settings.discard": "Скасувати зміни",
  "settings.unsaved": "Є незбережені зміни",
  "settings.saved": "Налаштування {name} збережено",
  "settings.readOnly":
    "Змінювати налаштування можуть лише адміністратори й редактори. Переглядати — можна.",
  "settings.hasErrors": {
    one: "Нічого не збережено: одне поле треба виправити. Його вкладку позначено.",
    few: "Нічого не збережено: {count} поля треба виправити. Їхні вкладки позначено.",
    many: "Нічого не збережено: {count} полів треба виправити. Їхні вкладки позначено.",
    other:
      "Нічого не збережено: {count} поля треба виправити. Їхні вкладки позначено.",
  },
  "settings.leaveTitle": "Піти без збереження?",
  "settings.leaveText":
    "Зміни на цій сторінці ще не збережено. Якщо піти, вони зникнуть.",
  "settings.stay": "Лишитися",
  "settings.leave": "Піти без збереження",
  "settings.default": "Типово: {value}",
  "settings.resetToDefault": "Повернути типове",
  "settings.on": "увімкнено",
  "settings.off": "вимкнено",
  "settings.recommended": "Рекомендовано",
  "settings.noSuggestions":
    "Підказки беруться з UI-дерев проєкту за останні 30 днів, а їх ще немає. Вводьте значення вручну; підказки з'являться після перших перевірок, надісланих з Appium page source.",

  "general.project": "Проєкт",
  "general.name": "Назва проєкту",
  "general.mainBranch": "Основна гілка",
  "general.mainBranchHelp":
    "Прийняті скриншоти цієї гілки — еталони, з якими порівнюються всі інші гілки.",
  "general.review": "Рев'ю змін",
  "general.reviewIntro":
    "Як скриншоти одного екрана групуються й приймаються в білді.",
  "general.autoApprove": "Приймати знайомі скриншоти у feature-гілках",
  "general.autoApproveHelp":
    "Скриншот у feature-гілці, точно такий, як уже прийнятий раніше для цієї перевірки, приймається без рев'ю. Вимкніть, щоб переглядати кожну зміну в кожній гілці.",
  "general.groupBy": "Об'єднувати перевірки, що відрізняються лише",
  "general.groupByHelp":
    "Перевірки з однаковою назвою, що відрізняються лише цим, — одна картка в білді, і їх переглядають разом.",
  "general.axis.customTags": "Тегами (мова, тема…)",
  "general.axis.customTagsHelp":
    "Наприклад, екран «Платіж» англійською, українською й у темній темі — одна картка з трьома скриншотами.",
  "general.axis.os": "Версією ОС",
  "general.axis.osHelp":
    "Наприклад, екран «Платіж» на Android 13, 14 і 15 — одна картка.",
  "general.axis.device": "Пристроєм",
  "general.axis.deviceHelp":
    "Наприклад, екран «Платіж» на Pixel 7 і Galaxy S23 — одна картка.",
  "general.axis.viewport": "Розміром екрана",
  "general.axis.viewportHelp":
    "Наприклад, екран «Платіж» 1080×2400 і 720×1600 — одна картка.",
  "general.axis.browser": "Браузером",
  "general.axis.browserHelp":
    "Наприклад, сторінка «Платіж» у Chrome і Safari — одна картка.",
  "general.bulkApprove": "Приймати чи відхиляти групу разом",
  "general.bulkApproveHelp":
    "Відкриває один діалог для всіх скриншотів групи. Позначені заздалегідь лише ті, де зміна однакова; інші лишаються вам на перегляд.",
  "general.cleanup": "Прибирання",
  "general.cleanupIntro":
    "Старі білди й гілки видаляються, щоб не переповнити диск.",
  "general.buildCount": "Скільки білдів зберігати",
  "general.buildCountHelp":
    "Коли приходить новий білд, найстаріші понад це число видаляються разом зі скриншотами.",
  "general.branchLifetime": "Видаляти еталони feature-гілок через, днів",
  "general.branchLifetimeHelp":
    "Еталони гілки, відмінної від {branch}, у яку стільки днів не надходило скриншотів, видаляються вночі.",
  "general.days": {
    one: "{count} день",
    few: "{count} дні",
    many: "{count} днів",
    other: "{count} дня",
  },

  "comparison.library": "Як порівнювати скриншоти",
  "comparison.libraryIntro":
    "Кожен новий скриншот порівнюється з еталоном піксель за пікселем. Зміна способу скидає параметри нижче до типових для нового.",
  "comparison.switchConfirm":
    "Параметри поточного способу буде замінено типовими для нового. Змінити?",
  "comparison.pixelmatch": "pixelmatch",
  "comparison.pixelmatchHelp":
    "Швидкий і передбачуваний: рахує пікселі, колір яких відрізняється більше за поріг. Підходить для скриншотів застосунків.",
  "comparison.lookSame": "looks-same",
  "comparison.lookSameHelp":
    "Порівнює кольори так, як їх бачить людина, і вміє не помічати курсор у полі. Повільніший за pixelmatch.",
  "comparison.odiff": "odiff",
  "comparison.odiffHelp":
    "Найшвидший на великих зображеннях; може одразу падати, якщо змінився розмір скриншота.",
  "comparison.vlm": "AI-модель (VLM)",
  "comparison.vlmHelp":
    "Візуальна мовна модель описує різницю словами. Потрібна Ollama або ключ Gemini; набагато повільніше.",
  "comparison.options": "Параметри способу",
  "comparison.threshold": "Поріг кольору",
  "comparison.thresholdHelp":
    "Наскільки може відрізнятися колір пікселя, щоб він не вважався зміненим: від 0 (будь-яка різниця) до 1 (жодна). 0,1 не помічає шуму рендерингу, але ловить змінений колір.",
  "comparison.odiffThresholdHelp":
    "Наскільки може відрізнятися колір пікселя, щоб він не вважався зміненим: від 0 (будь-яка різниця) до 1 (жодна).",
  "comparison.ignoreAntialiasing": "Не помічати згладжування",
  "comparison.ignoreAntialiasingHelp":
    "Згладжені краї тексту й іконок між запусками відрізняються на піксель; коли увімкнено, це не зміна.",
  "comparison.allowDiffDimensions": "Порівнювати скриншоти різного розміру",
  "comparison.allowDiffDimensionsHelp":
    "Вимкнено: скриншот іншого розміру, ніж еталон, одразу не проходить. Увімкнено: порівнюється спільна частина.",
  "comparison.strict": "Суворо",
  "comparison.strictHelp":
    "Будь-яка різниця кольору — зміна. Швидше, ніж допуск 0.",
  "comparison.tolerance": "Допуск",
  "comparison.toleranceHelp":
    "Наскільки можуть відрізнятися кольори для людського ока (ΔE). 2,3 — найменша різниця, яку помічає більшість людей.",
  "comparison.antialiasingTolerance": "Допуск згладжування",
  "comparison.antialiasingToleranceHelp":
    "Наскільки світлішим чи темнішим може бути піксель біля згладженого краю. Збільште, якщо краї все одно показуються як зміни.",
  "comparison.ignoreCaret": "Не помічати курсор у полі",
  "comparison.ignoreCaretHelp": "Курсор, що блимає в полі вводу, — не зміна.",
  "comparison.failOnLayoutDiff": "Не проходити, якщо змінився розмір",
  "comparison.failOnLayoutDiffHelp":
    "Скриншот іншого розміру, ніж еталон, не проходить без порівняння пікселів.",
  "comparison.outputDiffMask": "Зображення різниці — лише зміни",
  "comparison.outputDiffMaskHelp":
    "Увімкнено: на зображенні різниці лише змінені пікселі. Вимкнено: вони намальовані поверх скриншота.",
  "comparison.provider": "Постачальник моделі",
  "comparison.providerHelp":
    "Ollama працює на вашому сервері; Gemini — сервіс Google, потрібен ключ API.",
  "comparison.model": "Модель",
  "comparison.ollamaModelHelp": "Візуальна модель, встановлена в Ollama.",
  "comparison.ollamaNoModels":
    "Ollama не повернула жодної моделі; введіть назву моделі.",
  "comparison.unknownModel": "В Ollama немає такої моделі.",
  "comparison.geminiModelHelp": "Наприклад, gemini-1.5-pro.",
  "comparison.geminiModels": "Усі моделі Gemini",
  "comparison.apiKey": "Ключ API Gemini",
  "comparison.apiKeyHelp":
    "Зберігається з проєктом і надсилається лише в Google.",
  "comparison.prompt": "Запит до моделі",
  "comparison.promptHelp":
    "Що модель питають про еталон, новий скриншот і зображення різниці.",
  "comparison.temperature": "Температура",
  "comparison.temperatureHelp":
    "Від 0 до 1. Нижча — однакова відповідь на однакові зображення; вища — різноманітніші формулювання.",
  "comparison.useThinking": "Читати «роздуми» моделі",
  "comparison.useThinkingHelp":
    "Деякі моделі кладуть відповідь у частину з роздумами; увімкніть, якщо відповіді порожні.",

  "mobile.comparison": "Порівняння екранів за UI-деревом",
  "mobile.comparisonIntro":
    "Для скриншотів, надісланих з Appium page source. Дерево каже, що таке кожен елемент, тож Vision відрізняє справжні зміни від шуму.",
  "mobile.systemBars": "Не враховувати статус-бар і навігаційну панель",
  "mobile.systemBarsHelp":
    "Годинник, батарея й сигнал змінюються щоразу. Вимкнено: вони показуються як різниця.",
  "mobile.moves": "Порівнювати зсунуті елементи на новому місці",
  "mobile.movesHelp":
    "Банер зсунув список униз: елементи списку порівнюються там, де вони тепер, і зміною є лише банер. Зміна всередині зсунутого елемента все одно зміна.",
  "mobile.maxMove": "Лише зсуви до, dp",
  "mobile.maxMoveHelp":
    "Елемент, що зсунувся далі, — зміна. Порожньо: будь-яка відстань.",
  "mobile.anyDistance": "будь-яка відстань",
  "mobile.hidden": "Відправляти на рев'ю зміни, яких не видно на скриншоті",
  "mobile.hiddenHelp":
    "Новий підпис для читача екрана, кнопка стала неактивною чи некликабельною, невидимий елемент: скриншот той самий, але перевірка йде на рев'ю.",
  "mobile.loading": "Попереджати про завантаження",
  "mobile.loadingHelp":
    "Спінери, скелетони й тости на екрані означають, що скриншот зробили зарано; перевірка отримує попередження.",
  "mobile.wrongScreen": "Попереджати про не той екран",
  "mobile.wrongScreenHelp":
    "UI-дерево схоже на інший екран, ніж еталон (тест відкрив не те); перевірка отримує попередження.",
  "mobile.reference": "Еталонний пристрій",
  "mobile.referenceDevice": "Еталонний пристрій",
  "mobile.referenceHelp":
    "Інші пристрої перевірки порівнюються з ним елемент за елементом: текст, що відрізняється на одному пристрої, видно на рев'ю. Лише для інформації: статус не змінює ніколи.",
  "mobile.noReference": "Немає",
  "mobile.checks": {
    one: "{count} перевірка",
    few: "{count} перевірки",
    many: "{count} перевірок",
    other: "{count} перевірки",
  },
  "mobile.rules": "Правила елементів для всіх екранів",
  "mobile.rulesIntro":
    "Елементи, зміни яких не важливі на жодному екрані: годинник, карта, анімований банер.",
  "mobile.noRules": "Правил ще немає.",
  "mobile.element": "Елемент",
  "mobile.elementSearch": "Пошук за id, класом чи текстом",
  "mobile.elementSearchHelp":
    "Виберіть елемент проєкту або введіть id:…, class:… чи text:….",
  "mobile.elementTypeHelp": "id:…, class:… чи text:… (також text:/regex/).",
  "mobile.onScreens": {
    one: "на {count} екрані",
    few: "на {count} екранах",
    many: "на {count} екранах",
    other: "на {count} екрана",
  },
  "mobile.ruleAction": "Що з ним робити",
  "mobile.ignore": "Ігнорувати",
  "mobile.tolerate": "Допускати дрібні зміни",
  "mobile.percent": "До, %",
  "mobile.addRule": "Додати правило",
  "mobile.ignoreHelp":
    "Ігнорувати: область елемента не порівнюється, де б він не був.",
  "mobile.tolerateHelp":
    "Допускати дрібні зміни: елемент — зміна, лише коли відрізняється більша частка його пікселів, ніж задано.",
  "mobile.ignored": "ігнорується",
  "mobile.toleratedUpTo": "допускаються зміни до {percent}%",
  "mobile.notSeen": "не траплявся 30 днів",
  "mobile.removeRule": "Прибрати правило для {selector}",

  "a11y.intro":
    "На кожну проблему доступності — один баг у Jira. Проблема має id (a11y-…), який іде в заголовок і мітки бага; перед створенням Vision шукає його у своїх записах і в Jira, тож одну проблему ніколи не заводять двічі.",
  "a11y.screenTitle": "Назва екрана",
  "a11y.screenTitleIntro":
    "Проблеми й баги називають екран, на якому вони є. Vision читає назву з UI-дерева за цими селекторами; якщо жоден не підійшов, береться назва перевірки.",
  "a11y.titleFound": {
    one: "Знайдено в UI-деревах проєкту ({count} екран):",
    few: "Знайдено в UI-деревах проєкту ({count} екрани):",
    many: "Знайдено в UI-деревах проєкту ({count} екранів):",
    other: "Знайдено в UI-деревах проєкту ({count} екрана):",
  },
  "a11y.titleCoverage": "називає {count} з {total} екранів",
  "a11y.titleUse": "Використати",
  "a11y.titleUsed": "Використовується",
  "a11y.titleSelectors": "Селектори, перший збіг виграє",
  "a11y.titleSelectorsHelp":
    "По одному в рядку: id:Appbar#Title, id:toolbar_title, class:…, text:/regex/.",
  "a11y.sameProblem": "Коли дві знахідки — одна проблема",
  "a11y.sameProblemIntro":
    "Для кожного правила, для елементів з id. Одна проблема — один баг: заведений раз, він покриває всі екрани, де вона є. Елементи без id — завжди проблема свого екрана.",
  "a11y.sameProblemFor": "Одна проблема, коли: {rule}",
  "a11y.mode.componentValue": "Той самий компонент і значення",
  "a11y.mode.componentValueSame":
    "PbButton 38×38 dp на «Платежі» й на «Профілі» — одна проблема.",
  "a11y.mode.componentValueDifferent":
    "PbButton 38×38 dp і 40×40 dp — дві проблеми.",
  "a11y.mode.component": "Той самий компонент, будь-які значення",
  "a11y.mode.componentSame":
    "Усі замалі PbButton на будь-яких екранах, хоч якого розміру, — одна проблема.",
  "a11y.mode.componentDifferent": "PbButton і PbChip — дві проблеми.",
  "a11y.mode.screen": "Кожен екран окремо",
  "a11y.mode.screenSame":
    "Дві іконки без підпису на «Платежі» — одна проблема.",
  "a11y.mode.screenDifferent":
    "Та сама іконка на «Платежі» й на «Профілі» — дві проблеми.",
  "a11y.mode.class": "Усе, що бере цей клас",
  "a11y.mode.rule": "Як у правилі",
  "a11y.rule.touch-target": "Замала область натискання",
  "a11y.rule.low-contrast": "Низький контраст тексту",
  "a11y.rule.missing-label": "Елемент керування без підпису",
  "a11y.rule.input-without-label": "Поле вводу без підпису чи підказки",
  "a11y.rule.duplicate-label": "Однаковий підпис у кількох елементів",
  "a11y.rule.redundant-role": "Підпис повторює роль",
  "a11y.rule.not-accessible": "Елемент прихований від VoiceOver",
  "a11y.classes": "Класи проблем",
  "a11y.classesIntro":
    "Винятки з правил вище для окремих елементів: зробити всі вкладки однією проблемою або ігнорувати відомий хибний результат. Знахідку бере перший клас, що їй відповідає.",
  "a11y.noClasses": "Класів ще немає.",
  "a11y.newClass": "Новий клас",
  "a11y.className": "Назва",
  "a11y.classNamePlaceholder": "Наприклад: Таб-бар",
  "a11y.conditionsHelp":
    "Клас бере знахідку, коли збігаються всі заповнені поля. Вибирайте значення проєкту або вводьте шаблони; у полі досить збігу будь-якого.",
  "a11y.field.element": "Id елемента",
  "a11y.field.screen": "Екран",
  "a11y.field.className": "Клас елемента",
  "a11y.field.label": "Підпис елемента",
  "a11y.patternHelp":
    "Точне значення, шаблон з * і ? або /regex/. (Група) в regex id елемента — компонент.",
  "a11y.classRules": "Правила",
  "a11y.everyRule": "Усі правила",
  "a11y.classGroupBy": "Одна проблема, коли",
  "a11y.classAction": "Тоді",
  "a11y.fileBugs": "Заводити баги",
  "a11y.ignore": "Ігнорувати",
  "a11y.fileBugsHelp":
    "Знаходиться й заводиться як завжди, групується як вибрано вище.",
  "a11y.ignoreHelp":
    "Показується серед хибних результатів і ніколи не заводиться: для відомих винятків.",
  "a11y.coverage": {
    one: "Бере {count} елемент на {screens} екранах проєкту",
    few: "Бере {count} елементи на {screens} екранах проєкту",
    many: "Бере {count} елементів на {screens} екранах проєкту",
    other: "Бере {count} елемента на {screens} екранах проєкту",
  },
  "a11y.coverageNone":
    "Не бере нічого в UI-деревах проєкту за 30 днів: перевірте шаблони.",
  "a11y.addClass": "Додати клас",
  "a11y.ignored": "ігнорується",
  "a11y.up": "Вище",

  "jira.title": "Jira",
  "jira.intro":
    "Дає заводити баги доступності з екрана рев'ю. Кожен додає власний токен Jira у профілі, тож баги заводяться від його імені; спільний токен нижче — для тих, хто свого не додав.",
  "jira.url": "Адреса Jira",
  "jira.urlHelp": "Адреса, за якою ви відкриваєте Jira.",
  "jira.token": "Спільний токен (необов'язково)",
  "jira.tokenHelp":
    "Після збереження більше не показується. Лишіть порожнім, щоб не змінювати збережений.",
  "jira.tokenSaved": "Збережено. Лишіть порожнім, щоб не змінювати",
  "jira.tokenWillBeRemoved": "Збережений токен буде видалено",
  "jira.removeToken": "Видалити збережений токен",
  "jira.email": "Email акаунта спільного токена",
  "jira.emailHelp":
    "Лише для Jira Cloud: акаунт, якому належить спільний токен.",
  "jira.issueType": "Тип задачі",
  "jira.issueTypeHelp": "Тип, з яким створюються нові баги.",
  "jira.linkType": "Тип зв'язку",
  "jira.linkTypeHelp":
    "Як баг зв'язується із задачею, яку рев'юер вказує при створенні.",

  "validation.required": "Обов'язкове поле",
  "validation.twoCharacters": "Введіть щонайменше два символи.",
  "validation.wholeNumberFrom": "Введіть ціле число від {min}.",
  "validation.atLeast": "Введіть число від {min}.",
  "validation.between": "Введіть число від {min} до {max}.",
  "validation.selector": "Почніть з id:, class: або text:.",
  "validation.pattern": "Шаблон не компілюється: {error}",
  "validation.url": "Введіть адресу, що починається з http:// або https://.",
};
