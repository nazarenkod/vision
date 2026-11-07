# Аудит безпеки Vision — прогрес

Коміт: 7b13af1 (= origin/main). Дата: 2026-11-05. План: /root/.claude/plans/zazzy-finding-mochi.md

## Етапи
- [x] План погоджено
- [x] Етап 0 — розвідка, threat-model.md (audit/threat-model.md), endpoints.md
- [x] Етап 1 — сканування (audit/raw/): npm audit (0/0/0 prod+dev×3), osv-scanner (0), trivy fs vuln (0),
      trivy config (3×LOW healthcheck), trivy license (EPL-2.0 elkjs — вирізається при збірці, FP),
      semgrep (локальні правила), bandit, shellcheck, hadolint, gitleaks (5 FP — фікстури/README),
      license-checker (усе пермісивне), syft SBOM (audit/sbom.cdx.json, 810 комп.)
- [x] Етап 2 — ручний аудит: агенти A/B/C/D + мій розбір 2.8; зведено в findings.json
- [x] Стенд (нативний Postgres 16 :55432 + Node 24) + відтворення: VIS-SEC-001 (ескалація, repro-001),
      VIS-SEC-009/033/034 (repro-002), VIS-SEC-005 (офлайн, repro-003)
- [x] findings.json — 41 знахідка (Critical 1, High 6, Medium 14, Low 17, Info 3)
- [x] report.md → report.pdf (34 стор., перевірено посторінково; DFD-PNG з підписами; 42 VIS-SEC у PDF)

## Обмеження
- Без історії git (рішення власника). gitleaks --no-git; trufflehog не встановився (go replace) — покрито gitleaks+grep.
- Без Docker-демона → без trivy image; стенд нативний (не перевіряє runtime-ізоляцію контейнерів/ліміти compose).
- semgrep без реєстру semgrep.dev (локальні правила з GitHub); osv offline; trivy-db з mirror.gcr.io (ghcr DENIED).
- Gradle транзитивні: repo1/plugins.gradle 429 — повний граф не зібрано; прямі залежності й trivy fs (0 CVE) є.
- LDAP/OIDC-знахідки (006,007,020) — з коду, стенд LDAP/IdP не піднімався.
