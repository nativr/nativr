/** Development-only observer using the same public R condition boundary as the native oracle. */
export const packageConditionObserverSetup = String.raw`base::local({
  state <- base::new.env(parent = base::emptyenv())
  state$records <- base::list()
  state$bytes <- 0
  state$overflow <- FALSE
  observe <- function(kind, condition) {
    if (state$overflow) return(base::invisible(NULL))
    call <- base::conditionCall(condition)
    callText <- if (base::is.null(call)) NULL else base::paste(base::deparse(call, width.cutoff = 500L), collapse = " ")
    message <- base::conditionMessage(condition)
    classes <- base::class(condition)
    state$bytes <- state$bytes + base::sum(base::vapply(base::c(message, callText, classes), function(text) base::length(base::charToRaw(base::enc2utf8(text))), 0L))
    if (base::length(state$records) >= 10000L || state$bytes > 8388608L) {
      state$overflow <- TRUE
      return(base::invisible(NULL))
    }
    state$records[[base::length(state$records) + 1L]] <- base::list(kind, message, callText, classes, !base::is.null(base::getOption("error")))
    base::invisible(NULL)
  }
  warningObserver <- function(condition) observe("warning", condition)
  errorObserver <- function(condition) observe("error", condition)
  setAttribute <- base::get("attr<-", envir = base::baseenv())
  warningObserver <- setAttribute(warningObserver, "nativr.package.capture.state", state)
  errorObserver <- setAttribute(errorObserver, "nativr.package.capture.state", state)
  base::globalCallingHandlers(warning = warningObserver, error = errorObserver)
  base::invisible(NULL)
})`;

export const packageConditionObserverRead = String.raw`base::local({
  handlers <- base::globalCallingHandlers()
  marked <- base::vapply(handlers, function(handler) base::is.environment(base::attr(handler, "nativr.package.capture.state")), TRUE)
  kinds <- base::names(handlers)[marked]
  if (!base::all(base::c("warning", "error") %in% kinds)) {
    base::list(FALSE, base::list())
  } else {
    state <- base::attr(handlers[[base::which(marked)[1L]]], "nativr.package.capture.state")
    base::list(!state$overflow, state$records)
  }
})`;

/** Decode lossless snapshots, retaining class vectors and NULL calls without friendly-value collapse. */
export function decodePackageConditions(snapshot, completed) {
  if (snapshot.type !== "list" || snapshot.values.length !== 2)
    throw new Error("Invalid package condition observation.");
  const [complete, records] = snapshot.values;
  if (complete.type !== "logical" || complete.values.length !== 1 || records.type !== "list")
    throw new Error("Invalid package condition observation fields.");
  const conditions = records.values.map((record) => {
    if (record.type !== "list" || record.values.length !== 5)
      throw new Error("Invalid package condition record.");
    const [kindValue, messageValue, callValue, classesValue, handlerValue] = record.values;
    const kind = scalarText(kindValue);
    if (kind !== "warning" && kind !== "error") throw new Error("Invalid package condition kind.");
    if (classesValue.type !== "character" || classesValue.missing?.some(Boolean))
      throw new Error("Invalid package condition classes.");
    if (handlerValue.type !== "logical" || handlerValue.values.length !== 1)
      throw new Error("Invalid package condition handler state.");
    const hasHandler = handlerValue.values[0] === 1;
    return {
      kind,
      message: scalarText(messageValue),
      call: callValue.type === "null" ? null : scalarText(callValue),
      classes: [...classesValue.values],
      ...(kind === "error" && (!hasHandler || completed)
        ? { handled: hasHandler && completed }
        : {}),
    };
  });
  return {
    conditions,
    conditionsComplete: completed && complete.values[0] === 1 && !complete.missing?.[0],
  };
}

function scalarText(value) {
  if (value.type !== "character" || value.values.length !== 1 || value.missing?.[0])
    throw new Error("Invalid package condition text.");
  return value.values[0];
}
