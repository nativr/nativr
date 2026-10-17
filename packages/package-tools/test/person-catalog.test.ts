import { expect, it } from "vitest";
import { PERSON_ROLES } from "../../base/src/person-roles.js";
import { capturePackageOracleScript } from "../../../scripts/lib/package-oracle.mjs";

it.runIf(process.env.NATIVR_PACKAGE_ORACLE_FIXTURE === "1")(
  "pins person role codes through public GNU R behavior",
  async () => {
    // Exhaustive three-letter candidates are our own fixture, not an implementation extraction.
    const result = await capturePackageOracleScript({
      rscript: process.env.NATIVR_RSCRIPT ?? "Rscript",
      source:
        'local({ candidates<-as.vector(outer(as.vector(outer(letters,letters,paste0)),letters,paste0)); accepted<-suppressWarnings(utils::person("Fixture",role=candidates))$role; cat(paste(sort(accepted),collapse=" ")) })',
    });
    expect(result.status, result.stderr).toBe("completed");
    expect(result.stdout).toBe([...PERSON_ROLES].sort().join(" "));
  },
);
