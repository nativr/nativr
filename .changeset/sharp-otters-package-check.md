---
"@nativr/package-tools": minor
---

Package-check stages follow RFC-0008. Source-dependency policy v2 matches native R CMD check scope,
and new namespace-source, documentation and manual checks are exported:
`inspectPackageNamespaceSource`, `inspectPackageDocumentation`, `inspectPackageManual` and
`parseRd`. Every rule was observed on independently authored fixture packages against GNU R 4.6.1.
The pinned abind 1.4-8 is the first corpus package to reach P7.
