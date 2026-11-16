# deepmerge 4.3.1, Vision copy

[deepmerge](https://github.com/TehShrike/deepmerge) 4.3.1 (MIT, © James Halliday, Josh Duff and
contributors, see `license.txt`) with one change: `mergeObject` skips the keys `__proto__`,
`constructor` and `prototype`. With a target that has no prototype, a source key `__proto__`
replaced the prototype of the merged object (GHSA-gcqx-w48m-w2h4). 4.3.1 is the last release and
has no fix. Only Jest (`jest-config`) uses it, through `overrides` in the `package.json` next to this folder; it never
reaches the image.
