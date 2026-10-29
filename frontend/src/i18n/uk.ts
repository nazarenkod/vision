import { Messages } from "./en";

/** Тексти інтерфейсу українською: тип Messages вимагає кожен ключ en.ts (ADR-0016). */
export const uk: Messages = {
  "language.label": "Мова інтерфейсу",

  "common.cancel": "Скасувати",
  "common.remove": "Прибрати",
  "common.add": "Додати",
  "common.ignore": "Ігнорувати",
  "common.saved": "Збережено",
  "common.dismissNotification": "Закрити сповіщення",

  "header.home": "{brand}: головна",
  "header.help": "Довідка",
  "header.account": "Обліковий запис",
  "header.manualChecks": "Ручні перевірки (CLI)",
  "header.reportProblem": "Повідомити про проблему",
  "header.profile": "Профіль",
  "header.projects": "Проєкти",
  "header.users": "Користувачі",
  "header.backups": "Бекапи",
  "header.lightTheme": "Світла тема",
  "header.darkTheme": "Темна тема",
  "header.logout": "Вийти",

  "nav.main": "Головне меню",
  "nav.projects": "Проєкти",
  "nav.builds": "Білди",
  "nav.baselines": "Еталони",
  "nav.insights": "Insights",
  "nav.users": "Користувачі",
  "nav.profile": "Профіль",

  "projectList.title": "Проєкти",
  "projectList.search": "Пошук",
  "projectList.searchPlaceholder": "Назва проєкту",
  "projectList.add": "Додати проєкт",
  "projectList.project": "Проєкт",
  "projectList.mainBranch": "Основна гілка",
  "projectList.comparison": "Порівняння",
  "projectList.jira": "Jira",
  "projectList.created": "Створено",
  "projectList.actions": "Дії",
  "projectList.jiraConnected": "Підключено",
  "projectList.jiraNotSet": "Не налаштовано",
  "projectList.builds": "Білди",
  "projectList.baselines": "Еталони",
  "projectList.editOf": "Налаштування {name}",
  "projectList.deleteOf": "Видалити {name}",
  "projectList.noMatch": "Немає проєктів, що містять «{search}»",
  "projectList.empty": "Проєктів ще немає",
  "projectList.createTitle": "Новий проєкт",
  "projectList.create": "Створити проєкт",
  "projectList.createdToast": "Проєкт {name} створено",
  "projectList.deletedToast": "Проєкт {name} видалено",

  "deleteProject.title": "Видалити {name}?",
  "deleteProject.confirm":
    "Разом із ним зникнуть усі білди, еталони та їхня історія. Щоб підтвердити, введіть {name}.",
  "deleteProject.nameLabel": "Назва проєкту для підтвердження",
  "deleteProject.submit": "Видалити назавжди",

  "settings.title": "Налаштування",
  "settings.backToProjects": "Проєкти",
  "settings.sections": "Розділи налаштувань",
  "settings.find": "Знайти налаштування",
  "settings.unsavedMark": "незбережені зміни",
  "settings.noSuchProject": "Такого проєкту немає",
  "settings.maybeDeleted": "Можливо, його видалили.",
  "settings.nothingMatches": "Нічого не знайдено за «{query}»",
  "settings.nothingMatchesHint":
    "Спробуйте інше слово або очистьте пошук, щоб побачити всі розділи.",
  "settings.saved": "Збережено",
  "settings.unsavedIn": "Незбережені зміни: {sections}",
  "settings.discard": "Скасувати",
  "settings.save": "Зберегти зміни",
  "settings.conflictTitle":
    "Хтось зберіг ці налаштування після того, як ви відкрили сторінку",
  "settings.conflictChanged": "Відтоді змінено: {sections}.",
  "settings.conflictHint":
    "Перезавантажте, щоб побачити їхню версію (ваші зміни зникнуть), або збережіть свої поверх їхніх.",
  "settings.reload": "Перезавантажити налаштування",
  "settings.saveOver": "Зберегти поверх",
  "settings.leaveTitle": "Піти без збереження?",
  "settings.leaveText": "Незбережені зміни ({sections}) буде втрачено.",
  "settings.stay": "Лишитися",
  "settings.leave": "Піти",
  "settings.dangerText":
    "{title} Разом із ним зникнуть усі білди, еталони та їхня історія. Скасувати це неможливо.",
  "settings.dangerTitle": "Видалити цей проєкт.",
  "settings.deleteProject": "Видалити проєкт",
  "settings.meta.mobileOn": "{count} з 5 увімк.",
  "settings.meta.classes": {
    one: "{count} клас",
    few: "{count} класи",
    many: "{count} класів",
    other: "{count} класу",
  },
  "settings.meta.set": "є",
  "settings.meta.notSet": "немає",

  "section.general": "Загальне",
  "section.review": "Рев'ю",
  "section.comparison": "Порівняння зображень",
  "section.mobile": "Мобільні скриншоти",
  "section.rules": "Правила елементів",
  "section.a11y": "Проблеми доступності",
  "section.jira": "Jira",
  "section.danger": "Небезпечна зона",
  "section.comparisonIntro":
    "Як знімок порівнюється з еталоном. Під способами порівняння — параметри того, який ви виберете.",
  "section.mobileIntro": "Для скриншотів, надісланих з Appium page source.",
  "section.rulesIntro":
    "Для всіх екранів проєкту. Правило називає елемент за id, класом чи текстом; для тексту можна /regex/.",
  "section.a11yIntro":
    "Одна проблема — один баг. Проблема має id (a11y-…), який іде в заголовок і мітки бага в Jira; перед створенням бага Vision шукає його у своїх записах і в Jira.",
  "section.jiraIntro":
    "Дає рев'юерам заводити баги доступності з екрана рев'ю. Кожен додає власний токен Jira у профілі, тож баги заводяться від його імені. Спільний токен тут — для тих, хто свого ще не додав.",

  "general.name": "Назва проєкту",
  "general.mainBranch": "Основна гілка",
  "general.buildCount": "Скільки білдів зберігати",
  "general.branchLifetime": "Найдовше життя гілки (днів)",
  "general.newProjectHint":
    "Мобільні скриншоти, доступність і Jira налаштовуються в налаштуваннях проєкту — вони відкриються одразу після створення.",

  "review.autoApprove": "Автоматично приймати у feature-гілках",
  "review.bulkApprove": "Приймати й відхиляти варіації разом",
  "review.bulkApproveHelp":
    "Переглядайте й приймайте чи відхиляйте варіації одного екрана (наприклад, усі мови) в одному діалозі. Наперед вибрано лише варіації з однаковою зміною; інші лишаються для ручного рев'ю.",
  "review.groupBy": "Групувати варіації за",
  "review.groupByHelp":
    "Вісь варіацій, якою відрізняються перевірки в групі. Екрани, однакові в усьому, крім цієї осі, групуються в списку перевірок і переглядаються разом — наприклад, customTags для скриншотів різними мовами.",

  "comparison.library": "Бібліотека порівняння зображень",
  "comparison.engines": "Порівняння зображень",
  "comparison.pixelmatchHelp":
    "Піксель за пікселем. Швидко й передбачувано; типовий спосіб.",
  "comparison.lookSameHelp":
    "Не помічає згладжування й курсор у полі. Добре для екранів з великою кількістю тексту.",
  "comparison.odiffHelp":
    "Найшвидший на великих скриншотах. Може падати на будь-якій зміні розмітки.",
  "comparison.vlmHelp":
    "Питає візуальну модель, чи важлива зміна. Повільніше; потрібен постачальник моделі.",
  "comparison.allowDiffDimensions": "Порівнювати зображення різного розміру",
  "comparison.allowDiffDimensionsHelp":
    "Дозволяє порівнювати зображення різного розміру.",
  "comparison.ignoreAntialiasing": "Не помічати згладжування",
  "comparison.ignoreAntialiasingHelp":
    "Згладжені пікселі не вважаються зміною.",
  "comparison.ignoreAntialiasingLooksSame": "Не помічати згладжування",
  "comparison.threshold": "Поріг різниці пікселя",
  "comparison.thresholdHelp":
    "Наскільки може відрізнятися піксель, доки його не вважають зміненим (0–1).",
  "comparison.strict": "Суворо",
  "comparison.tolerance": "Допуск",
  "comparison.toleranceHelp":
    "Типовий допуск у несуворому режимі — 2,3, і цього досить майже завжди. Допуск 0 дає те саме, що strict: true, але суворий режим швидший. Допуск у суворому режимі дає помилку.",
  "comparison.antialiasingTolerance": "Допуск згладжування",
  "comparison.antialiasingToleranceHelp":
    "Найменша різниця яскравості (типово нуль) між найтемнішим чи найсвітлішим пікселем біля згладженого пікселя і його сусідами.",
  "comparison.ignoreCaret": "Не помічати курсор у полі",
  "comparison.outputDiffMask": "Зображення різниці — лише зміни",
  "comparison.failOnLayoutDiff": "Не проходити, якщо змінився розмір",
  "comparison.provider": "Постачальник VLM",
  "comparison.model": "Модель",
  "comparison.modelRequired": "Потрібна модель",
  "comparison.loadingModels": "Завантаження моделей…",
  "comparison.noModels": "Моделей немає. Введіть назву моделі вручну.",
  "comparison.unknownModel": "Вибраної моделі немає серед доступних.",
  "comparison.ollamaModelHelp":
    "Модель Ollama для порівняння зображень. Список моделей береться із сервісу Ollama.",
  "comparison.geminiModel": "Модель Gemini",
  "comparison.geminiModelHelp":
    "Модель Google Gemini для порівняння зображень.",
  "comparison.geminiModelName": "Назва моделі Gemini.",
  "comparison.geminiModels": "Усі доступні моделі",
  "comparison.geminiKey": "Ключ API Gemini",
  "comparison.geminiKeyNew": "Ключ API Gemini",
  "comparison.geminiKeyRequired": "Потрібен ключ API",
  "comparison.geminiKeyHelp":
    "Ваш ключ API Google Gemini. Отримати його можна на https://makersuite.google.com/app/apikey",
  "comparison.geminiKeyEnter": "Введіть свій ключ API Google Gemini",
  "comparison.prompt": "Запит до моделі",
  "comparison.promptRequired": "Потрібен запит",
  "comparison.promptHelp":
    "Текст, який надсилається VLM, щоб вона проаналізувала різницю між зображеннями.",
  "comparison.temperature": "Температура",
  "comparison.temperatureHelp":
    "Наскільки випадкова відповідь VLM. Нижчі значення (0–0,3) дають сталіші результати, вищі (0,7–1) — різноманітніші.",
  "comparison.temperatureShortHelp":
    "Випадковість відповіді (0–1). Нижчі значення — сталіші.",
  "comparison.useThinking": "Режим роздумів",
  "comparison.useThinkingHelp": "Вмикає режим роздумів моделі VLM.",

  "mobile.title": "Мобільні скриншоти (UI-дерево)",
  "mobile.systemBars": "Не враховувати статус-бар і навігаційну панель",
  "mobile.systemBarsHelp": "Годинник, батарея й сигнал змінюються щоразу.",
  "mobile.moves": "Порівнювати зсунуті елементи на новому місці",
  "mobile.movesHelp":
    "Елемент, який лише зсунувся (банер штовхнув список униз), — не різниця; зміна всередині нього — різниця.",
  "mobile.hidden": "Відправляти на рев'ю невидимі зміни",
  "mobile.hiddenHelp":
    "Новий підпис, неактивний чи некликабельний елемент, невидима кнопка: зміни, яких не видно в пікселях.",
  "mobile.loading": "Попереджати про завантаження",
  "mobile.loadingHelp":
    "Спінери, скелетони й тости означають, що скриншот зробили зарано.",
  "mobile.wrongScreen": "Попереджати про не той екран",
  "mobile.wrongScreenHelp": "UI-дерево схоже на інший екран, ніж еталон.",
  "mobile.reference": "Еталонний пристрій",
  "mobile.referenceHelp":
    "Інші пристрої перевірки порівнюються з ним елемент за елементом, для інформації; статус від цього не змінюється.",
  "mobile.noReference": "Немає",
  "mobile.checks": {
    one: "({count} перевірка)",
    few: "({count} перевірки)",
    many: "({count} перевірок)",
    other: "({count} перевірки)",
  },
  "mobile.maxMove": "Лише зсуви до, dp (порожньо — будь-які)",

  "rules.title": "Правила елементів для всіх екранів",
  "rules.ignored": "ігнорується",
  "rules.element": "Елемент",
  "rules.elementPlaceholder": "id:clock або class:MapView",
  "rules.elementHelp": "id:, class: або text: (для тексту можна /regex/)",
  "rules.selectorError": "Почніть з id:, class: або text:, наприклад id:banner",
  "rules.tolerate": "Допускати",

  "a11y.title": "Проблеми доступності",
  "a11y.intro":
    "Одна проблема — один баг. Проблема має id (a11y-…), який іде в заголовок і мітки бага в Jira; перед створенням бага Vision шукає його у своїх записах і в Jira, а знайдені в Jira проблеми позначає як заведені.",
  "a11y.screenTitle": "Назва екрана в UI-дереві",
  "a11y.screenTitleHelp":
    "По одному селектору в рядку, перший збіг виграє: id:Appbar#Title, id:toolbar_title, class:…, text:/regex/. Без збігу екраном вважається назва перевірки.",
  "a11y.sameProblem": "Одна проблема, коли",
  "a11y.sameProblemIntro":
    "Для кожного правила, для елементів з id. Проблема компонента стосується кожного екрана з ним: заведена раз, покриває всі. Елементи без id — завжди проблема свого екрана.",
  "a11y.sameProblemFor": "Одна проблема, коли: {rule}",
  "a11y.mode.componentValue": "Той самий компонент і значення",
  "a11y.mode.component": "Той самий компонент, будь-які значення",
  "a11y.mode.screen": "Кожен екран окремо",
  "a11y.mode.class": "Усе, що бере цей клас",
  "a11y.rule.touchTarget": "Замала область натискання",
  "a11y.rule.lowContrast": "Низький контраст тексту",
  "a11y.rule.missingLabel": "Елемент керування без підпису",
  "a11y.rule.inputWithoutLabel": "Поле вводу без підпису чи підказки",
  "a11y.rule.duplicateLabel": "Однаковий підпис у кількох елементів",
  "a11y.rule.redundantRole": "Підпис повторює роль",
  "a11y.rule.notAccessible": "Елемент прихований від VoiceOver",
  "a11y.classes": "Класи проблем",
  "a11y.howMatching": "Як працює зіставлення",
  "a11y.howMatchingText":
    "Перший збіг виграє. Клас бере знахідку, коли збігаються всі заповнені поля; у полі — по одному шаблону в рядку, досить збігу будь-якого. Шаблони — це маски з * і ? або /regex/; група в regex id елемента стає компонентом, тож {example} робить tab_0…tab_3 однією проблемою. «Усе, що бере цей клас» робить усе це однією проблемою; «Ігнорувати» показує його серед хибних результатів і ніколи не заводить. Id проблем від цих налаштувань не змінюються: що є однією проблемою, щоразу визначається з того, для чого кожну проблему заведено.",
  "a11y.checkedAt": "Перевіряється {position}",
  "a11y.everyRule": "усі правила",
  "a11y.ignored": "ігнорується",
  "a11y.rulesSetting": "як у правилі",
  "a11y.up": "Вище",
  "a11y.field.element": "Id елемента",
  "a11y.field.screen": "Екран",
  "a11y.field.className": "Клас елемента",
  "a11y.field.label": "Підпис елемента",
  "a11y.className": "Назва",
  "a11y.patternHelp": "По одному шаблону в рядку",
  "a11y.required": "Обов'язкове поле",
  "a11y.classRules": "Правила",
  "a11y.classRulesHelp": "Порожньо — усі правила",
  "a11y.classRuleSetting": "Як у правилі",
  "a11y.classAction": "Тоді",
  "a11y.fileBugs": "Заводити баги",
  "a11y.addClass": "Додати клас",

  "jira.title": "Jira",
  "jira.intro":
    "Дає рев'юерам заводити баги доступності з екрана рев'ю. Кожен додає власний токен Jira у профілі, тож баги заводяться від його імені. Спільний токен тут необов'язковий: він для тих, хто свого ще не додав.",
  "jira.url": "Адреса Jira",
  "jira.token": "Спільний токен (необов'язково)",
  "jira.email": "Email акаунта спільного токена (лише Jira Cloud)",
  "jira.issueType": "Тип задачі",
  "jira.linkType": "Тип зв'язку",

  "secret.replace": "Замінити",
  "secret.removedOnSave": "Буде видалено під час збереження",
  "secret.undo": "Повернути",
  "secret.keepSaved": "Лишіть порожнім, щоб не змінювати збережений",

  "validation.twoCharacters": "Введіть щонайменше два символи.",
  "validation.greaterThan": "Введіть число, більше за {min}",
  "validation.lessThan": "Введіть число, менше за {max}",
  "validation.atLeast": "Введіть число від {min}",
  "validation.atMost": "Введіть число до {max}",
};
