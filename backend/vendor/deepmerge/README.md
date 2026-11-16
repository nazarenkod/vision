# deepmerge 4.3.1, копія Vision

[deepmerge](https://github.com/TehShrike/deepmerge) 4.3.1 (MIT, © James Halliday, Josh Duff та
контриб'ютори, див. `license.txt`) з однією зміною: `mergeObject` пропускає ключі `__proto__`,
`constructor` і `prototype`. Якщо в цілі немає прототипу, ключ `__proto__` з джерела підміняв
прототип об'єднаного об'єкта (GHSA-gcqx-w48m-w2h4). 4.3.1 — останній реліз, виправлення в ньому
немає. Використовує лише Jest (`jest-config`) через `overrides` у `package.json` поруч із цією
папкою; в образ не потрапляє.
