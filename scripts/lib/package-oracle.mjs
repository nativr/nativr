import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { alignOrderedOutput } from "./package-output-order.mjs";

const requiredVersion = "4.6.1";
const defaultTimeoutMs = 120_000;
const defaultMaxOutputBytes = 8 * 1024 * 1024;

/** Node-only, optional black-box oracle. No GNU R implementation is imported or shipped. */
export async function createPackageOracle(options) {
  validatePackage(options.expectedPackage);
  if (!/^[a-f0-9]{64}$/u.test(options.expectedSourceSha256 ?? "")) {
    throw new Error("A pinned lowercase SHA-256 is required for the oracle package archive.");
  }
  const archive = path.resolve(options.archive);
  const bytes = await readFile(archive);
  if (createHash("sha256").update(bytes).digest("hex") !== options.expectedSourceSha256) {
    throw new Error("The oracle package archive does not match its pinned SHA-256.");
  }
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-package-oracle-"));
  try {
    const library = path.join(temporaryRoot, "library");
    await mkdir(library);
    const pinnedArchive = path.join(temporaryRoot, "pinned-source.tar.gz");
    await writeFile(pinnedArchive, bytes, { flag: "wx" });
    const environment = oracleEnvironment(library);
    const probe = await runPackageOracleProcess(
      options.rscript,
      ["--vanilla", "-e", 'cat(as.character(getRversion()), R.home("bin"), sep = "\\n")'],
      processOptions(options, environment),
    );
    requireSuccess(probe, "GNU R version probe");
    const [version, binaryDirectory] = normalizeNewlines(probe.stdout).trim().split("\n");
    assertVersion(version);
    if (!binaryDirectory || !path.isAbsolute(binaryDirectory)) {
      throw new Error("GNU R did not report an absolute binary directory.");
    }
    const newlineTransport = await probeNewlineTransport(options, environment);
    const installation = await runPackageOracleProcess(
      path.join(binaryDirectory, process.platform === "win32" ? "R.exe" : "R"),
      ["--vanilla", "CMD", "INSTALL", "--no-multiarch", `--library=${library}`, pinnedArchive],
      processOptions(options, environment),
    );
    requireSuccess(installation, "Pinned GNU R package installation");
    let disposed = false;
    const capture = async (script) => {
      if (disposed) throw new Error("The package oracle has been disposed.");
      return capturePackageOracleScript({
        ...options,
        ...script,
        library,
        newlineTransport: newlineTransport.kind,
        expectedPackage: options.expectedPackage,
      });
    };
    const identity = await capture({ source: "invisible(NULL)" });
    if (identity.status !== "completed") {
      throw new Error(`Installed package identity probe failed: ${identity.stderr}`);
    }
    return {
      version,
      packageVersion: identity.packageVersion,
      sourceSha256: options.expectedSourceSha256,
      newlineTransport,
      installation,
      capture,
      async dispose() {
        disposed = true;
        await removeTemporaryRoot(temporaryRoot);
      },
    };
  } catch (error) {
    await removeTemporaryRoot(temporaryRoot);
    throw error;
  }
}

/** Capture one unchanged script in a fresh native top-level R session. */
export async function capturePackageOracleScript(options) {
  if (typeof options.source !== "string") throw new TypeError("Oracle source must be text.");
  if (options.expectedPackage !== undefined) validatePackage(options.expectedPackage);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nativr-package-capture-"));
  try {
    const metadataPath = path.join(temporaryRoot, "observations.tsv");
    const runnerPath = path.join(temporaryRoot, "runner.R");
    const workingDirectory = path.join(temporaryRoot, "work");
    await mkdir(workingDirectory);
    await mountFiles(workingDirectory, options.files ?? []);
    if (options.outputOrder === true) {
      await mkdir(path.join(temporaryRoot, "work-ordered"));
      await mountFiles(path.join(temporaryRoot, "work-ordered"), options.files ?? []);
    }
    const prefix = observerPrelude();
    // The package source is byte-for-byte unchanged between these independently written probes.
    // Rscript itself parses and evaluates native top-level expressions, including options(error).
    await writeFile(runnerPath, `${prefix}\n${options.source}\n${observerFooter()}\n`, "utf8");
    await writeFile(metadataPath, "", "utf8");
    const environment = (metadataFile) => ({
      ...oracleEnvironment(options.library),
      NATIVR_ORACLE_METADATA: metadataFile,
      NATIVR_ORACLE_PACKAGE: options.expectedPackage?.name ?? "",
      NATIVR_ORACLE_PACKAGE_VERSION: options.expectedPackage?.version ?? "",
    });
    const separated = await runBoundedProcess(options.rscript, ["--vanilla", runnerPath], {
      ...processOptions(options, environment(metadataPath)),
      cwd: workingDirectory,
    });
    const processResult = decodeProcessResult(separated);
    const metadata = parseMetadata(await readFile(metadataPath, "utf8"));
    // A killed process may never have emitted its identity. It is never accepted as completed.
    if (metadata.version !== undefined) assertVersion(metadata.version);
    const completed = runCompleted(processResult, metadata);
    const ordered =
      options.outputOrder === true
        ? await captureOrderedOutput({
            options,
            runnerPath,
            separated,
            separatedCompleted: completed,
            metadataPath: path.join(temporaryRoot, "observations-ordered.tsv"),
            mergedPath: path.join(temporaryRoot, "merged-output.bin"),
            workingDirectory: path.join(temporaryRoot, "work-ordered"),
            environment,
          })
        : { status: "unrequested" };
    return {
      ...processResult,
      status: completed ? "completed" : "failed",
      version: metadata.version ?? null,
      packageVersion: metadata.packageVersion ?? null,
      sourceSha256: createHash("sha256").update(options.source, "utf8").digest("hex"),
      freshSession: true,
      runtimeSettings:
        metadata.runtimeSettings === null
          ? null
          : {
              ...metadata.runtimeSettings,
              newlineTransport: options.newlineTransport ?? "unprobed",
            },
      conditions: metadata.conditions.map((condition) => {
        const { hasErrorHandler, ...observed } = condition;
        if (condition.kind === "error" && (!hasErrorHandler || completed)) {
          return { ...observed, handled: Boolean(hasErrorHandler && completed) };
        }
        return observed;
      }),
      ...(ordered.status === "complete" ? { outputOrder: ordered.events } : {}),
      limitations: {
        sourcePrefixLines: prefix.split("\n").length,
        conditionObservation: "globalCallingHandlers-after-source-handlers",
        crossStreamOrder:
          ordered.status === "complete" ? "merged-handle-unique-alignment-v1" : "unobserved",
        outputOrder: ordered.status,
        ...(ordered.reason === undefined ? {} : { outputOrderReason: ordered.reason }),
        incompleteHandlerReturn: !completed,
        nativeLineEndings: "preserved",
        conditionObserversPresentAtCompletion: metadata.observersPresent,
      },
    };
  } finally {
    await removeTemporaryRoot(temporaryRoot);
  }
}

/**
 * Rerun the same unchanged runner in another fresh session with stdout and stderr sharing one file
 * handle, as an R CMD check transcript does. GNU R writes each console emission as it occurs, so
 * the handle records native cross-stream byte order without R-level sinks or any change to the
 * evaluated program. Stream identity comes from aligning those bytes with the separate capture.
 */
async function captureOrderedOutput(context) {
  if (!context.separatedCompleted) {
    return { status: "incomplete", reason: "separate-capture-incomplete" };
  }
  await writeFile(context.metadataPath, "", "utf8");
  const merged = await runMergedProcess(
    context.options.rscript,
    ["--vanilla", context.runnerPath],
    {
      ...processOptions(context.options, context.environment(context.metadataPath)),
      cwd: context.workingDirectory,
      outputPath: context.mergedPath,
    },
  );
  const metadata = parseMetadata(await readFile(context.metadataPath, "utf8"));
  if (metadata.version !== undefined) assertVersion(metadata.version);
  if (!runCompleted(merged, metadata)) {
    return {
      status: "incomplete",
      reason:
        merged.reason === "exited" ? "merged-capture-failed" : `merged-capture-${merged.reason}`,
    };
  }
  return alignOrderedOutput(context.separated.stdout, context.separated.stderr, merged.output);
}

function runCompleted(processResult, metadata) {
  return (
    processResult.reason === "exited" &&
    processResult.exitCode === 0 &&
    metadata.completed &&
    metadata.version === requiredVersion &&
    metadata.identityValid &&
    metadata.observersPresent
  );
}

/** Bounded subprocess used by the optional oracle; never invokes a shell. */
export function runPackageOracleProcess(command, arguments_, options = {}) {
  return runBoundedProcess(command, arguments_, options).then(decodeProcessResult);
}

function decodeProcessResult(result) {
  return {
    ...result,
    stdout: result.stdout.toString("utf8"),
    stderr: result.stderr.toString("utf8"),
  };
}

/**
 * Bounded subprocess whose stdout and stderr are the same newly created file handle, so the file
 * receives the child's writes to either stream in the order the child makes them.
 */
export async function runMergedProcess(command, arguments_, options) {
  const timeoutMs = positiveInteger(options.timeoutMs ?? defaultTimeoutMs, "timeoutMs");
  const maxOutputBytes = positiveInteger(
    options.maxOutputBytes ?? defaultMaxOutputBytes,
    "maxOutputBytes",
  );
  const handle = await open(options.outputPath, "wx");
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const child = spawn(command, arguments_, {
        env: options.env ?? process.env,
        cwd: options.cwd,
        windowsHide: true,
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["ignore", handle.fd, handle.fd],
      });
      let reason = "exited";
      const stop = (why) => {
        if (reason !== "exited") return;
        reason = why;
        terminateProcessTree(child);
      };
      const timer = setTimeout(() => stop("timed-out"), timeoutMs);
      // A shared file handle is not a pipe, so its size is polled to bound runaway output.
      const poll = setInterval(() => {
        handle.stat().then(
          (stats) => {
            if (stats.size > maxOutputBytes) stop("output-limit");
          },
          () => {},
        );
      }, 100);
      child.on("error", (error) => {
        clearTimeout(timer);
        clearInterval(poll);
        reject(error);
      });
      child.on("close", (exitCode, signal) => {
        clearTimeout(timer);
        clearInterval(poll);
        resolve({ exitCode, signal, reason });
      });
    });
  } finally {
    await handle.close();
  }
  const reader = await open(options.outputPath, "r");
  try {
    const size = (await reader.stat()).size;
    if (size > maxOutputBytes && result.reason === "exited") result.reason = "output-limit";
    const output = Buffer.alloc(Math.min(size, maxOutputBytes));
    let filled = 0;
    while (filled < output.byteLength) {
      const { bytesRead } = await reader.read(output, filled, output.byteLength - filled, filled);
      if (bytesRead === 0) break;
      filled += bytesRead;
    }
    return { ...result, output: output.subarray(0, filled) };
  } finally {
    await reader.close();
  }
}

function runBoundedProcess(command, arguments_, options = {}) {
  const timeoutMs = positiveInteger(options.timeoutMs ?? defaultTimeoutMs, "timeoutMs");
  const maxOutputBytes = positiveInteger(
    options.maxOutputBytes ?? defaultMaxOutputBytes,
    "maxOutputBytes",
  );
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      env: options.env ?? process.env,
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let reason = "exited";
    const stop = (why) => {
      if (reason !== "exited") return;
      reason = why;
      terminateProcessTree(child);
    };
    const timer = setTimeout(() => stop("timed-out"), timeoutMs);
    const collect = (destination, chunk) => {
      const available = Math.max(0, maxOutputBytes - outputBytes);
      destination.push(chunk.subarray(0, available));
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) stop("output-limit");
    };
    child.stdout.on("data", (chunk) => collect(stdout, chunk));
    child.stderr.on("data", (chunk) => collect(stderr, chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        exitCode,
        signal,
        reason,
      });
    });
  });
}

function terminateProcessTree(child) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    const killer = spawn(
      path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "taskkill.exe"),
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true, shell: false, stdio: "ignore", timeout: 5_000 },
    );
    killer.on("error", () => child.kill("SIGKILL"));
    killer.on("close", (code) => {
      if (code !== 0) child.kill("SIGKILL");
    });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

function observerPrelude() {
  return String.raw`base::local({
  metadata <- base::Sys.getenv("NATIVR_ORACLE_METADATA")
  emit <- function(...) base::cat(..., "\n", file = metadata, append = TRUE, sep = "")
  hex <- function(value) base::paste(base::sprintf("%02x", base::as.integer(base::charToRaw(base::enc2utf8(value)))), collapse = "")
  version <- base::as.character(base::getRversion())
  emit("version\t", version)
  if (!base::identical(version, "4.6.1")) base::stop("Package oracle requires GNU R 4.6.1", call. = FALSE)
  package <- base::Sys.getenv("NATIVR_ORACLE_PACKAGE")
  if (base::nzchar(package)) {
    actual <- utils::packageVersion(package)
    expected <- base::package_version(base::Sys.getenv("NATIVR_ORACLE_PACKAGE_VERSION"))
    emit("package\t", base::as.character(actual))
    if (!base::identical(actual, expected)) base::stop("Installed package version differs from its pin", call. = FALSE)
  }
  emit("identity-valid")
  emit("settings\t", if (base::isTRUE(base::getOption("keep.source"))) "1" else "0", "\t", if (base::isTRUE(base::getOption("keep.source.pkgs"))) "1" else "0", "\t", hex(base::Sys.getenv("R_ENABLE_JIT")), "\t", base::.Platform$OS.type)
  observations <- 0L
  observationBytes <- 0L
  observe <- function(kind, condition) {
    observations <<- observations + 1L
    call <- base::conditionCall(condition)
    callText <- if (base::is.null(call)) "-" else hex(base::paste(base::deparse(call, width.cutoff = 500L), collapse = " "))
    handler <- base::getOption("error")
    hasHandler <- !base::is.null(handler)
    fields <- base::paste(kind, hex(base::conditionMessage(condition)), callText, base::paste(base::vapply(base::class(condition), hex, ""), collapse = ","), if (hasHandler) "1" else "0", sep = "\t")
    observationBytes <<- observationBytes + base::nchar(fields, type = "bytes")
    if (observations > 10000L || observationBytes > 8388608L) base::quit(save = "no", status = 86L, runLast = FALSE)
    emit(fields)
  }
  warningObserver <- function(condition) observe("warning", condition)
  errorObserver <- function(condition) observe("error", condition)
  base::attr(warningObserver, "nativr.package.oracle.observer") <- TRUE
  base::attr(errorObserver, "nativr.package.oracle.observer") <- TRUE
  base::globalCallingHandlers(warning = warningObserver, error = errorObserver)
})`;
}

function observerFooter() {
  return String.raw`base::local({
  observers <- base::globalCallingHandlers()
  observed <- base::vapply(observers, function(handler) base::isTRUE(base::attr(handler, "nativr.package.oracle.observer")), TRUE)
  kinds <- base::names(observers)[observed]
  if (base::all(base::c("warning", "error") %in% kinds)) base::cat("observers-present\n", file = base::Sys.getenv("NATIVR_ORACLE_METADATA"), append = TRUE)
  base::cat("completed\n", file = base::Sys.getenv("NATIVR_ORACLE_METADATA"), append = TRUE)
})`;
}

function parseMetadata(text) {
  const result = {
    conditions: [],
    completed: false,
    identityValid: false,
    observersPresent: false,
    runtimeSettings: null,
  };
  for (const line of normalizeNewlines(text).split("\n")) {
    const [kind, message, call, classes, hasHandler] = line.split("\t");
    if (kind === "version") result.version = message;
    else if (kind === "package") result.packageVersion = message;
    else if (kind === "completed") result.completed = true;
    else if (kind === "identity-valid") result.identityValid = true;
    else if (kind === "observers-present") result.observersPresent = true;
    else if (kind === "settings") {
      result.runtimeSettings = {
        keepSource: message === "1",
        keepSourcePackages: call === "1",
        jitEnvironment: decodeHex(classes),
        osType: hasHandler,
      };
    } else if (kind === "warning" || kind === "error") {
      result.conditions.push({
        kind,
        message: decodeHex(message),
        call: call === "-" ? null : decodeHex(call),
        classes: classes === "" ? [] : classes.split(",").map(decodeHex),
        hasErrorHandler: hasHandler === "1",
      });
    }
  }
  return result;
}

function decodeHex(value) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{2})*$/u.test(value)) {
    throw new Error("Malformed GNU R package oracle observation.");
  }
  return Buffer.from(value, "hex").toString("utf8");
}

function oracleEnvironment(library = "") {
  return {
    ...process.env,
    LC_ALL: "C",
    LC_CTYPE: "C",
    LANG: "C",
    LANGUAGE: "en",
    R_LIBS: library,
    R_LIBS_USER: library,
    R_LIBS_SITE: "",
  };
}

async function probeNewlineTransport(options, environment) {
  const literal = "a\nb\r\nc\rd\r\r\ne";
  const probe = await runPackageOracleProcess(
    options.rscript,
    [
      "--vanilla",
      "-e",
      'cat("a\\nb\\r\\nc\\rd\\r\\r\\ne"); cat("a\\nb\\r\\nc\\rd\\r\\r\\ne", file = stderr())',
    ],
    processOptions(options, environment),
  );
  requireSuccess(probe, "GNU R newline transport probe");
  const translated = literal.replaceAll("\n", "\r\n");
  const kind =
    probe.stdout === literal && probe.stderr === literal
      ? "identity"
      : probe.stdout === translated && probe.stderr === translated
        ? "lf-to-crlf"
        : "unknown";
  return {
    kind,
    probeLiteralHex: Buffer.from(literal).toString("hex"),
    stdoutHex: Buffer.from(probe.stdout).toString("hex"),
    stderrHex: Buffer.from(probe.stderr).toString("hex"),
  };
}

function processOptions(options, env) {
  return { env, timeoutMs: options.timeoutMs, maxOutputBytes: options.maxOutputBytes };
}

function validatePackage(expected) {
  if (
    !expected ||
    !/^[A-Za-z][A-Za-z0-9.]*$/u.test(expected.name ?? "") ||
    !/^\d+(?:[.-]\d+)*$/u.test(expected.version ?? "")
  ) {
    throw new Error("A pinned package name and numeric version are required.");
  }
}

function assertVersion(version) {
  if (version !== requiredVersion) {
    throw new Error(`The package oracle requires GNU R ${requiredVersion}; found ${version}.`);
  }
}

function requireSuccess(result, label) {
  if (result.reason !== "exited" || result.exitCode !== 0) {
    throw new Error(
      `${label} failed (${result.reason}, exit ${result.exitCode}): ${result.stderr}`,
    );
  }
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return value;
}

function normalizeNewlines(value) {
  return value.replaceAll("\r\n", "\n");
}

async function removeTemporaryRoot(temporaryRoot) {
  const absolute = path.resolve(temporaryRoot);
  const relative = path.relative(path.resolve(os.tmpdir()), absolute);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !/^nativr-package-(?:oracle|capture)-[^/\\]+$/u.test(relative)
  ) {
    throw new Error(`Refusing to remove an unsafe oracle temporary directory: ${absolute}`);
  }
  await rm(absolute, { recursive: true, force: true });
}

async function mountFiles(root, files) {
  let totalBytes = 0;
  const paths = new Set();
  if (files.length > 10_000) throw new Error("Too many oracle fixture files.");
  for (const file of files) {
    if (
      typeof file.path !== "string" ||
      file.path === "" ||
      /[\\:\0]/u.test(file.path) ||
      file.path
        .split("/")
        .some(
          (part) =>
            part === "" ||
            part === "." ||
            part === ".." ||
            /[<>"|?*]|[. ]$/u.test(part) ||
            /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(part),
        ) ||
      !(file.data instanceof Uint8Array)
    ) {
      throw new Error("Oracle fixture files require canonical relative paths and byte data.");
    }
    const target = path.resolve(root, ...file.path.split("/"));
    const relative = path.relative(root, target);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Oracle fixture path escapes its private working directory.");
    }
    const key = process.platform === "win32" ? target.toLowerCase() : target;
    if (paths.has(key)) throw new Error(`Duplicate oracle fixture path: ${file.path}`);
    paths.add(key);
    totalBytes += file.data.byteLength;
    if (totalBytes > 256 * 1024 * 1024) throw new Error("Oracle fixture files exceed 256 MiB.");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.data, { flag: "wx" });
  }
}
