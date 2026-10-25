import { createHash } from "node:crypto";

import { expect, profiledRun, test } from "./helpers/required-example-profile.js";

test("runs the required Worker examples without evaluation network traffic", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();

  await page.locator("#source").fill('Sys.getenv("NATIVR_PLAYGROUND")');
  await profiledRun(page, "required-001");
  await expect(page.locator("#result")).toHaveText('"worker"');

  await page.locator("#source").fill("nativrdemo::find_tools(c('nativr-echo', 'missing'))");
  await profiledRun(page, "required-002");
  await expect(page.locator("#result")).toHaveText('["nativr://host/bin/nativr-echo", ""]');

  const evaluationRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/u.test(request.url())) evaluationRequests.push(request.url());
  });
  await page
    .locator("#source")
    .fill('local({ x <- quote(a); for(i in 1:600) x <- call("f", x); deparse(x) })');
  await profiledRun(page, "required-003");
  await expect(page.locator("#errors")).toContainText("NRL4004");
  expect(evaluationRequests).toEqual([]);
  for (const source of [
    'nchar(sprintf("%100000000000000000000000000000s", "x"))',
    'nchar(sprintf("%.100000000000000000000000000000f", 0.125))',
  ]) {
    await page.locator("#source").fill(source);
    await profiledRun(page, "required-004");
    await expect(page.locator("#errors")).toContainText("NRL4007");
  }
  await page.locator("#source").fill('sprintf("%.100000000000000000000000000000g", 1.25)');
  await profiledRun(page, "required-005");
  await expect(page.locator("#result")).toHaveText('"1.25"');
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);
  await page.locator("#source").fill(`local({
    lt <- function(sec, year=70L) structure(list(sec=sec, min=0L, hour=0L, mday=1L,
      mon=0L, year=year, wday=0L, yday=0L, isdst=0L),
      class=c("POSIXlt", "POSIXt"), tzone="UTC")
    x <- lt(c(0, Inf, NA_real_))
    c(identical(as.numeric(as.POSIXct(x)), c(0, Inf, NA_real_)),
      identical(is.finite(x), c(TRUE, FALSE, FALSE)),
      as.numeric(as.POSIXct(lt(.125, 1000000L))) == 31554743011200.125)
  })`);
  await profiledRun(page, "required-006");
  await expect(page.locator("#result")).toHaveText("[true, true, true]");
  expect(evaluationRequests).toEqual([]);
  await page.locator("#source").fill(`local({
    g <- function(x) UseMethod("g")
    g.integer <- function(x) NextMethod()
    g.numeric <- function(x) list(classes=.Class, storage=typeof(x), public=class(x))
    value <- g(1L)
    c(identical(value$classes, structure("numeric", previous=c("integer", "numeric"))),
      identical(value$storage, "integer"), identical(value$public, "integer"))
  })`);
  await profiledRun(page, "required-007");
  await expect(page.locator("#result")).toHaveText("[true, true, true]");
  expect(evaluationRequests).toEqual([]);
  await page.locator("#source").fill(`local({
    events <- 0L
    original <- function() { events <<- events + 1L; "original" }
    g <- function(x, y) UseMethod("g", 1L)
    g.integer <- function(x, y) NextMethod()
    g.numeric <- function(x, y) list(value=x, classes=.Class)
    value <- g(original(), stop("unused original forced"))
    c(identical(value$value, "original"), identical(events, 1L),
      identical(value$classes, structure("numeric", previous=c("integer", "numeric"))))
  })`);
  await profiledRun(page, "required-008");
  await expect(page.locator("#result")).toHaveText("[true, true, true]");
  expect(evaluationRequests).toEqual([]);
  await page.locator("#source").fill(`local({
    g <- function(x=stop("unused generic default forced")) UseMethod("g")
    g.NULL <- function(x=7L) list(value=x, missing=missing(x), classes=.Class)
    g.name <- function(x=9L) list(value=x, missing=missing(x), classes=.Class)
    c(identical(g(), list(value=7L, missing=TRUE, classes="NULL")),
      identical(g(x=), list(value=9L, missing=TRUE, classes="name")))
  })`);
  await profiledRun(page, "required-009");
  await expect(page.locator("#result")).toHaveText("[true, true]");
  expect(evaluationRequests).toEqual([]);
  await page.locator("#source").fill(`local({
    events <- character()
    g <- function(x) {
      on.exit(events <<- c(events, "generic"))
      UseMethod("g")
      stop("generic continued")
    }
    g.default <- function(x) {
      on.exit(events <<- c(events, "method"))
      invisible(7L)
    }
    value <- withVisible(g(1L))
    c(identical(value, list(value=7L, visible=FALSE)),
      identical(events, c("method", "generic")))
  })`);
  await profiledRun(page, "required-010");
  await expect(page.locator("#result")).toHaveText("[true, true]");
  expect(evaluationRequests).toEqual([]);
  await page.locator("#source").fill(`local({
    trace <- character()
    g <- function(x) {
      on.exit(trace <<- c(trace, "cleanup"))
      for (i in 1L) UseMethod("g", stop("selector forced"))
      99L
    }
    g.default <- function(x) stop("method entered")
    problem <- tryCatch(g(stop("original forced")), error=function(e) conditionMessage(e))
    h <- function(x) UseMethod(object=1L, generic="h")
    h.integer <- function(x) invisible(7L)
    c(identical(problem, "'UseMethod' used in an inappropriate fashion"),
      identical(trace, "cleanup"),
      identical(withVisible(h(1L)), list(value=7L, visible=FALSE)))
  })`);
  await profiledRun(page, "required-011");
  await expect(page.locator("#result")).toHaveText("[true, true, true]");
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill(`local({
  trace <- character()
  helper <- function(y) {
    on.exit(trace <<- c(trace, "helper cleanup"))
    y
  }
  g <- function(x) {
    on.exit(trace <<- c(trace, "generic cleanup"))
    helper(UseMethod("g", {
      trace <<- c(trace, "selector forced")
      1L
    }))
    99L
  }
  g.default <- function(x) {
    trace <<- c(trace, "forbidden method")
    7L
  }
  problem <- tryCatch(g({
    trace <<- c(trace, "original forced")
    stop("original forced")
  }), error=function(e) conditionMessage(e))
  rejected <- identical(problem, "'UseMethod' used in an inappropriate fashion") &&
    identical(trace, c("helper cleanup", "generic cleanup"))

  good <- function(x) {
    UseMethod("good")
    stop("continued")
  }
  good.default <- function(x) 7L
  recovered <- helper(good(1L))

  ownDefault <- function(y=UseMethod("ownDefault")) {
    y
    99L
  }
  ownDefault.default <- function(...) 7L
  c(rejected,
    identical(recovered, 7L),
    identical(trace, c("helper cleanup", "generic cleanup", "helper cleanup")),
    identical(ownDefault(), 7L))
})`);
  await profiledRun(page, "required-012");
  await expect(page.locator("#result")).toHaveText("[true, true, true, true]");
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill(`local({
  trace <- character()
  selector <- function() { trace <<- c(trace, "selector"); 1L }
  message_of <- function(value) tryCatch(value, error = function(e) conditionMessage(e))
  missing_name <- function(x) UseMethod(object = selector())
  invalid_name <- function(x) UseMethod(1L, selector())
  admission <- identical(message_of(missing_name(1L)), "there must be a 'generic' argument") &&
    identical(message_of(invalid_name(1L)), "'generic' argument must be a character string") &&
    identical(trace, character())

  NA.integer <- function(x) 17L
  .integer <- function(x) 19L
  na_name <- function(x) UseMethod(NA_character_, selector())
  empty_name <- function(x) UseMethod("", selector())
  routing <- identical(c(na_name(1L), empty_name(1L)), c(17L, 19L)) &&
    identical(trace, c("selector", "selector"))

  trace <- character()
  helper <- function(value) value
  invalid_loop <- function(x) { for (i in 1L) UseMethod(1L, selector()); 99L }
  invalid_actual <- function(x) helper(UseMethod(character(), selector()))
  invalid_first <- identical(message_of(invalid_loop(1L)), "'generic' argument must be a character string") &&
    identical(message_of(invalid_actual(1L)), "'generic' argument must be a character string") &&
    identical(trace, character())

  valid_loop <- function(x) { for (i in 1L) UseMethod(NA_character_, selector()); 99L }
  valid_actual <- function(x) helper(UseMethod(NA_character_, selector()))
  context_next <- identical(message_of(valid_loop(1L)), "'UseMethod' used in an inappropriate fashion") &&
    identical(message_of(valid_actual(1L)), "'UseMethod' used in an inappropriate fashion") &&
    identical(trace, character())
  c(admission, routing, invalid_first, context_next)
})`);
  await profiledRun(page, "required-013");
  await expect(page.locator("#result")).toHaveText("[true, true, true, true]");
  expect(evaluationRequests).toEqual([]);
  await page
    .locator("#source")
    .fill(
      "data(iris)\nc(as.character(dim(iris)), class(iris$Species), as.character(iris$Species[c(1, 51, 101)]))",
    );
  await profiledRun(page, "required-014");
  await expect(page.locator("#result")).toHaveText(
    '["150", "5", "factor", "setosa", "versicolor", "virginica"]',
  );
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill(`
    assign("reflect<-", function(x, value) list(source = substitute(value), call = match.call(), value = value))
    reflected <- 0
    reflect(reflected) <- 1 + 2
    c(identical(reflected$source, quote(1 + 2)), identical(eval(reflected$call$value), 3), identical(reflected$value, 3))
  `);
  await profiledRun(page, "required-015");
  await expect(page.locator("#result")).toHaveText("[true, true, true]");
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill("print(1:15, width = 20); invisible(NULL)");
  await profiledRun(page, "required-016");
  await expect(page.locator("#result")).toHaveText("null");
  expect(await page.locator("#console-output").textContent()).toBe(
    " [1]  1  2  3  4  5\n [6]  6  7  8  9 10\n[11] 11 12 13 14 15\n",
  );
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill("print(function(x) { x <- x + 1; x^2 }); invisible(NULL)");
  await profiledRun(page, "required-017");
  await expect(page.locator("#console-output")).toContainText("function (x)");
  expect(await page.locator("#console-output").textContent()).toBe(
    "function (x) \n{\n    x <- x + 1\n    x^2\n}\n",
  );
  expect(evaluationRequests).toEqual([]);

  await page
    .locator("#source")
    .fill("print(table(c(FALSE, TRUE, TRUE))); print(table(a = integer())); invisible(NULL)");
  await profiledRun(page, "required-018");
  await expect(page.locator("#console-output")).toContainText("< table of extent 0 >");
  expect(await page.locator("#console-output").textContent()).toBe(
    "\nFALSE  TRUE \n    1     2 \n< table of extent 0 >\n",
  );
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill(`
    report <- all.equal(c(1, 2), c(2, 4), scale = c(1, 2), tolerance = 0, giveErr = TRUE,
      formatFUN = function(err, what) paste0(what, ":", err))
    previous_options <- options(digits = 3, OutDec = ",")
    formatted_number <- format(1 / 3)
    cat(c(1 / 3, 1e-12), sep = "|")
    options(previous_options)
    c(report, formatted_number, attr(report, "what"))
  `);
  await profiledRun(page, "required-019");
  await expect(page.locator("#result")).toHaveText(
    '["Mean scaled difference: scaled:1", "0,333", "scaled"]',
  );
  await expect(page.locator("#console-output")).toHaveText("0,333|1e-12");
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill(`local({
    conditionMessage.fixture <- function(c) paste0("custom:", c$message)
    e <- simpleError("captured", quote(origin(1)))
    custom <- structure(list(message = "text"), class = c("fixture", "condition"))
    c(conditionMessage(e), deparse(conditionCall(e)), conditionMessage(custom))
  })`);
  await profiledRun(page, "required-020");
  await expect(page.locator("#result")).toHaveText('["captured", "origin(1)", "custom:text"]');
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill(`local({
    x <- matrix(-1:-6, 3)
    reflected <- call("identity", x)
    c(identical(eval(reflected), x),
      identical(deparse(reflected, width.cutoff = 500), "identity(structure(-1:-6, dim = 3:2))"))
  })`);
  await profiledRun(page, "required-021");
  await expect(page.locator("#result")).toHaveText("[true, true]");
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Scalar arithmetic" }).click();
  await profiledRun(page, "required-022");
  await expect(page.locator("#result")).toHaveText("2");
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Vector mean" }).click();
  await profiledRun(page, "required-023");
  await expect(page.locator("#result")).toHaveText("3");

  await page.locator("#source").fill(`
    stored <- 2L
    active_environment <- new.env()
    makeActiveBinding(
      "doubled",
      function(value) if (missing(value)) stored * 2L else stored <<- value / 2L,
      active_environment
    )
    active_environment$doubled <- 10L
    c(active_environment$doubled, stored, bindingIsActive("doubled", active_environment))
  `);
  await profiledRun(page, "required-024");
  await expect(page.locator("#result")).toHaveText("[10, 5, 1]");

  await page
    .locator("#source")
    .fill(
      's <- utils::object.size(double(1000))\nc(unclass(s), format(s, units = "auto", standard = "IEC"))',
    );
  await profiledRun(page, "required-025");
  await expect(page.locator("#result")).toHaveText('["8048", "7.9 KiB"]');

  await page.getByRole("button", { name: "Function + closure" }).click();
  await profiledRun(page, "required-026");
  await expect(page.locator("#result")).toHaveText("16");

  await page.getByRole("button", { name: "Typed native adapter" }).click();
  await profiledRun(page, "required-027");
  await expect(page.locator("#result")).toHaveText("10");

  await page.getByRole("button", { name: "Pure-R package bundle" }).click();
  await profiledRun(page, "required-028");
  await expect(page.locator("#result")).toHaveText("6");

  await page.locator("#source").fill('nativrdemo::private_call("hidden_helper", 5)');
  await profiledRun(page, "required-029");
  await expect(page.locator("#result")).toHaveText("105");

  await page.locator("#source").fill("nativrdemo::create_file()");
  await profiledRun(page, "required-030");
  await expect(page.locator("#result")).toHaveText("[1, 1, 0, 0]");

  await page.locator("#source").fill("nativrdemo::plot_series(c(2, 5, 1, 4))");
  await profiledRun(page, "required-031");
  await expect(page.locator("#result")).toHaveText("4");
  await expect(page.locator("#graphics-count")).toHaveText("5");
  const timeSeriesPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let dark = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        (pixels[index] ?? 255) < 80 &&
        (pixels[index + 1] ?? 255) < 80 &&
        (pixels[index + 2] ?? 255) < 80 &&
        (pixels[index + 3] ?? 0) > 0
      ) {
        dark += 1;
      }
    }
    return dark;
  });
  expect(timeSeriesPixels).toBeGreaterThan(100);

  await page.getByRole("button", { name: "Recursive time-series filter" }).click();
  await profiledRun(page, "required-032");
  await expect(page.locator("#result")).toHaveText("[1, 2.8, 5.24, 8.192, 11.5536, 15.24288]");

  await page.getByRole("button", { name: "Package DESCRIPTION" }).click();
  await profiledRun(page, "required-033");
  await expect(page.locator("#result")).toHaveText(
    '["nativrdemo", "0.1.0", "Browser-Native R Demo", "Apache-2.0", "nativrdemo"]',
  );

  await page.getByRole("button", { name: "Pure-R package discovery" }).click();
  await profiledRun(page, "required-034");
  await expect(page.locator("#result")).toHaveText(
    '["nativrdemo", "DESCRIPTION", "NAMESPACE", "R", "doc", "extdata"]',
  );

  await page.getByRole("button", { name: "Pure-R UTF-8 detection" }).click();
  await profiledRun(page, "required-035");
  await expect(page.locator("#result")).toHaveText("true");

  await page.getByRole("button", { name: "Pure-R shell quoting" }).click();
  await profiledRun(page, "required-036");
  await expect(page.locator("#result")).toHaveText(`["'package path'", "'plain'"]`);

  await page.getByRole("button", { name: "Pure-R package ZIP member" }).click();
  await profiledRun(page, "required-037");
  await expect(page.locator("#result")).toHaveText('["alpha", "beta"]');
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Standard output connection" }).click();
  await profiledRun(page, "required-038");
  await expect(page.locator("#result")).toHaveText(
    '["terminal", "connection", "terminal", "TRUE", "FALSE", "TRUE"]',
  );
  await expect(page.locator("#console-output")).toHaveText("package-worker-output");

  await page.locator("#source").fill("nativrdemo::signature_names()");
  await profiledRun(page, "required-039");
  await expect(page.locator("#result")).toHaveText('"x"');

  await page
    .locator("#source")
    .fill("debugonce(nativrdemo::twice_mean)\nnativrdemo::twice_mean(c(1, 2, 6))");
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    expect(dialog.message()).toBe("Browse[1]> ");
    await dialog.accept("c");
  });
  await profiledRun(page, "required-040");
  await expect(page.locator("#result")).toHaveText("6");
  await expect(page.locator("#console-output")).toContainText(
    "debugging in: nativrdemo::twice_mean(c(1, 2, 6))",
  );

  await page.locator("#source").fill('nativrdemo::dynamic_summary(structure(1:3, class = "demo"))');
  await profiledRun(page, "required-041");
  await expect(page.locator("#result")).toHaveText('"worker-dynamic:6"');

  await page.locator("#source").fill("nativrdemo::resource_size()");
  await profiledRun(page, "required-042");
  await expect(page.locator("#result")).toHaveText("14");

  await page.locator("#source").fill("nativrdemo::event_colours()");
  await profiledRun(page, "required-043");
  await expect(page.locator("#result")).toHaveText('["#D33F6A4D", "#E2E2E24D", "#4A6FE34D"]');

  await page.locator("#source").fill("nativrdemo::classic_palettes(1)");
  await profiledRun(page, "required-044");
  await expect(page.locator("#result")).toHaveText('["#FF0000", "#F2F2F2", "#4C00FF", "#80FFFF"]');

  await page.locator("#source").fill("nativrdemo::usage_rectangles()");
  await profiledRun(page, "required-045");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const rectanglePixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let translucentBlack = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 255;
      const green = pixels[index + 1] ?? 255;
      const blue = pixels[index + 2] ?? 255;
      if (red >= 150 && red < 245 && red === green && green === blue) translucentBlack += 1;
    }
    return translucentBlack;
  });
  expect(rectanglePixels).toBeGreaterThan(100);

  await page.locator("#source").fill("nativrdemo::remove_files()");
  await profiledRun(page, "required-046");
  await expect(page.locator("#result")).toHaveText("[true, true, true, true, false, false]");

  await page.getByRole("button", { name: "Pure-R package file copy" }).click();
  await profiledRun(page, "required-047");
  await expect(page.locator("#result")).toHaveText('["TRUE", "{\\"demo\\":true}", "TRUE"]');

  await page.locator("#source").fill("nativrdemo::fixed_text()");
  await profiledRun(page, "required-048");
  await expect(page.locator("#result")).toHaveText('["{\\"demo\\":true}\\n", "bookmarked"]');

  await page.locator("#source").fill("nativrdemo::custom_axis()");
  await profiledRun(page, "required-049");
  await expect(page.locator("#result")).toHaveText("[1, 2, 3]");

  await page.locator("#source").fill("nativrdemo::sourced_value()");
  await profiledRun(page, "required-050");
  await expect(page.locator("#result")).toHaveText("42");

  await page
    .locator("#source")
    .fill(
      "v <- utils::vignette('browser-runtime', package = 'nativrdemo')\nc(v$Topic, v$Title, v$PDF)",
    );
  await profiledRun(page, "required-051");
  await expect(page.locator("#result")).toHaveText(
    '["browser-runtime", "Running R in a browser Worker", "browser-runtime.html"]',
  );

  await page.getByRole("button", { name: "Pure-R package vignette catalog" }).click();
  await profiledRun(page, "required-052");
  await expect(page.locator("#browse-count")).toHaveText("1");
  await page.locator("#browse-requests").getByRole("button", { name: "Preview" }).click();
  const vignetteCatalog = page.frameLocator("#browse-requests iframe");
  await expect(vignetteCatalog.getByRole("heading", { name: "R Vignettes" })).toBeVisible();
  await expect(vignetteCatalog.getByText("Running R in a browser Worker")).toBeVisible();
  await expect(vignetteCatalog.getByRole("link", { name: "HTML" })).toHaveAttribute(
    "href",
    /^data:text\/html;base64,/u,
  );

  await page.getByRole("button", { name: "Pure-R package help page" }).click();
  await profiledRun(page, "required-053");
  await expect(page.locator("#browse-count")).toHaveText("1");
  await page.locator("#browse-requests").getByRole("button", { name: "Preview" }).click();
  const helpPage = page.frameLocator("#browse-requests iframe");
  await expect(helpPage.getByRole("heading", { name: "Double an arithmetic mean" })).toBeVisible();
  await expect(helpPage.getByText("unchanged pure R package code")).toBeVisible();
  await expect(helpPage.getByText("twice_mean(x)")).toBeVisible();

  await page
    .locator("#source")
    .fill("utils::example(twice_mean, package = 'nativrdemo', echo = FALSE)\nexample_value");
  await profiledRun(page, "required-054");
  await expect(page.locator("#result")).toHaveText("6");

  await page.getByRole("button", { name: "Explicit host command" }).click();
  await profiledRun(page, "required-055");
  await expect(page.locator("#result")).toHaveText('["worker", "bridge"]');

  await page.getByRole("button", { name: "Structured system2 command" }).click();
  await profiledRun(page, "required-056");
  await expect(page.locator("#result")).toHaveText('["system2-worker", "structured-command"]');

  await page.getByRole("button", { name: "Pure-R package spell check" }).click();
  await profiledRun(page, "required-057");
  await expect(page.locator("#result")).toHaveText('["compatiblity", "1", "9", "compatibility"]');

  await page.getByRole("button", { name: "Pure-R package pipe" }).click();
  await profiledRun(page, "required-058");
  await expect(page.locator("#result")).toHaveText('["pipe-worker", "package-pipe"]');
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Pure-R package socket" }).click();
  await profiledRun(page, "required-059");
  await expect(page.locator("#result")).toHaveText(
    '["socket-worker", "package-socket", "FALSE", "5"]',
  );
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Browser readline input" }).click();
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    expect(dialog.message()).toBe("Your name: ");
    await dialog.accept("\t browser user \t");
  });
  await profiledRun(page, "required-060");
  await expect(page.locator("#result")).toHaveText('"Hello, browser user"');

  await page.locator("#source").fill(`
      grDevices::graphics.off()
      grDevices::devAskNewPage(TRUE)
      graphics::plot.new()
      graphics::plot.new()
      grDevices::devAskNewPage()
    `);
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("prompt");
    expect(dialog.message()).toBe("Hit <Return> to see next plot: ");
    await dialog.accept("");
  });
  await profiledRun(page, "required-061");
  await expect(page.locator("#result")).toHaveText("true");

  await page
    .locator("#source")
    .fill(
      'c(class(getLoadedDLLs()), length(getLoadedDLLs()), getLoadedDLLs()[["nativr.demo"]]$path)',
    );
  await profiledRun(page, "required-062");
  await expect(page.locator("#result")).toHaveText(
    '["DLLInfoList", "1", "wasm://playground/nativr-demo.wasm"]',
  );

  await page.getByRole("button", { name: "URL connection" }).click();
  await profiledRun(page, "required-063");
  await expect(page.locator("#result")).toHaveText('["worker-url", "package-connection"]');
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Pure-R package download" }).click();
  await profiledRun(page, "required-064");
  await expect(page.locator("#result")).toHaveText('["0", "worker-url", "package-connection"]');
  expect(evaluationRequests).toEqual([]);

  await page.locator("#source").fill("system('blocked', intern = TRUE)");
  await profiledRun(page, "required-065");
  await expect(page.locator("#result")).toHaveText("Evaluation failed.");
  await expect(page.locator("#errors")).toContainText("not allow-listed");

  await page.locator("#source").fill("Sys.sleep(0.01)\n7");
  await profiledRun(page, "required-066");
  await expect(page.locator("#result")).toHaveText("7");

  await page.locator("#source").fill(`
    path <- tempfile()
    con <- file(path, "w+")
    writeLines("worker", con)
    seek(con, 0)
    value <- readLines(con)
    open_state <- isOpen(con, "read")
    closed <- close(con)
    c(value, open_state, closed)
  `);
  await profiledRun(page, "required-067");
  await expect(page.locator("#result")).toHaveText('["worker", "TRUE", "0"]');

  await page.locator("#source").fill(`
    path <- tempfile(fileext = ".gz")
    output <- gzcon(file(path, "wb"), text = TRUE)
    writeLines(c("worker", "gzip"), output)
    close(output)
    magic <- as.integer(readBin(path, "raw", n = 3L))
    input <- gzcon(file(path, "rb"), text = TRUE)
    lines <- readLines(input)
    close(input)
    c(magic, lines, unlink(path))
  `);
  await profiledRun(page, "required-068");
  await expect(page.locator("#result")).toHaveText('["31", "139", "8", "worker", "gzip", "0"]');

  await page.locator("#source").fill(`
    path <- tempfile(fileext = ".csv")
    write.csv(data.frame(label = c("a,b", "c"), value = c(1L, NA_integer_)), path, row.names = FALSE)
    table <- read.csv(path)
    c(names(table), table$label, typeof(table$value), table$value, unlink(path))
  `);
  await profiledRun(page, "required-069");
  await expect(page.locator("#result")).toHaveText(
    '["label", "value", "a,b", "c", "integer", "1", NA, "0"]',
  );

  await page.locator("#source").fill(`
    root <- tempfile("worker-tree-")
    dir.create(file.path(root, "nested"), recursive = TRUE)
    old <- setwd(root)
    writeLines("worker-relative", file.path("nested", "value.txt"))
    value <- readLines(file.path("nested", "value.txt"))
    entries <- list.files(".", recursive = TRUE, include.dirs = TRUE)
    setwd(old)
    c(value, entries, dir.exists(root), unlink(root, recursive = TRUE))
  `);
  await profiledRun(page, "required-070");
  await expect(page.locator("#result")).toHaveText(
    '["worker-relative", "nested", "nested/value.txt", "TRUE", "0"]',
  );

  await page.getByRole("button", { name: "Numeric R plot" }).click();
  await profiledRun(page, "required-071");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("6");

  await page.locator("#source").fill(`
    path <- tempfile(fileext = ".png")
    grDevices::png(path, width = 64, height = 48, bg = "transparent")
    graphics::plot.new()
    graphics::segments(0, 0, 1, 1)
    grDevices::dev.off()
    bytes <- as.integer(readBin(path, "raw", n = 1000000L))
    c(
      bytes[1:8],
      sum(bytes[17:20] * 256 ^ (3:0)),
      sum(bytes[21:24] * 256 ^ (3:0)),
      length(bytes) > 100L
    )
  `);
  await profiledRun(page, "required-072");
  await expect(page.locator("#result")).toHaveText("[137, 80, 78, 71, 13, 10, 26, 10, 64, 48, 1]");

  await page.locator("#source").fill(`
    path <- tempfile(fileext = ".pdf")
    grDevices::pdf(
      path, width = 2, height = 2,
      compress = FALSE, timestamp = FALSE, producer = FALSE
    )
    graphics::plot.new()
    graphics::segments(0, 0, 1, 1)
    grDevices::dev.off()
    bytes <- as.integer(readBin(path, "raw", n = 1000000L))
    c(bytes[1:8], length(bytes) > 400L)
  `);
  await profiledRun(page, "required-073");
  await expect(page.locator("#result")).toHaveText("[37, 80, 68, 70, 45, 49, 46, 52, 1]");

  await page.locator("#source").fill('x <- setNames(seq(10, 20, by = 10), c("a", "b"))\nx[["b"]]');
  await profiledRun(page, "required-074");
  await expect(page.locator("#result")).toHaveText("20");

  await page.locator("#source").fill("FALSE && not.bound");
  await profiledRun(page, "required-075");
  await expect(page.locator("#result")).toHaveText("false");

  await page
    .locator("#source")
    .fill("total <- 0\nfor (i in 1:4) { if (i == 3) next; total <- total + i }\ntotal");
  await profiledRun(page, "required-076");
  await expect(page.locator("#result")).toHaveText("7");

  await page.locator("#source").fill("all.vars(y ~ x + z)");
  await profiledRun(page, "required-077");
  await expect(page.locator("#result")).toHaveText('["y", "x", "z"]');

  await page.locator("#source").fill("c(1, NA, 3) |> mean(na.rm = TRUE)");
  await profiledRun(page, "required-078");
  await expect(page.locator("#result")).toHaveText("2");

  await page.locator("#source").fill('class(structure(1:3, class = "score"))');
  await profiledRun(page, "required-079");
  await expect(page.locator("#result")).toHaveText('"score"');

  await page.locator("#source").fill("m <- matrix(1:6, nrow = 2)\nm[1, 2] <- 30\nm[1, ]");
  await profiledRun(page, "required-080");
  await expect(page.locator("#result")).toHaveText("[1, 30, 5]");

  await page.locator("#source").fill(`
    describe <- function(x) UseMethod("describe")
    describe.score <- function(x) sum(x)
    describe(structure(1:3, class = c("score", "numeric")))
  `);
  await profiledRun(page, "required-081");
  await expect(page.locator("#result")).toHaveText("6");

  await page
    .locator("#source")
    .fill('Box <- R6::R6Class("Box", public = list(value = 1))\nBox$new(value = 3)$value');
  await profiledRun(page, "required-082");
  await expect(page.locator("#result")).toHaveText("3");

  await page
    .locator("#source")
    .fill("set.seed(2)\nsample(1:3, 4, replace = TRUE, prob = c(0, 0, 1))");
  await profiledRun(page, "required-083");
  await expect(page.locator("#result")).toHaveText("[3, 3, 3, 3]");

  await page.locator("#source").fill("(1 + 2i) * (3 - 4i)");
  await profiledRun(page, "required-084");
  await expect(page.locator("#result")).toHaveText("11+2i");

  await page.locator("#source").fill('charToRaw("NativR")');
  await profiledRun(page, "required-085");
  await expect(page.locator("#result")).toHaveText("4e 61 74 69 76 52");

  await page.locator("#source").fill('charToRaw("\\101\\xff")');
  await profiledRun(page, "required-086");
  await expect(page.locator("#result")).toHaveText("41 ff");
  await page.locator("#source").fill('escape_probe <- 1L; "\\q"');
  await profiledRun(page, "required-087");
  await expect(page.locator("#errors")).toContainText("NRP1003");
  await page.locator("#source").fill('exists("escape_probe")');
  await profiledRun(page, "required-088");
  await expect(page.locator("#result")).toHaveText("false");

  await page.locator("#source").fill('eval(parse(text = c("x <- 6", "x + 1")))');
  await profiledRun(page, "required-089");
  await expect(page.locator("#result")).toHaveText("7");

  await page
    .locator("#source")
    .fill("p <- structure(pairlist(1, 2, 3, 4), dim = c(2, 2))\np[[2]] <- 20\np");
  await profiledRun(page, "required-090");
  await expect(page.locator("#result")).toHaveText("[1, 20, 3, 4]");

  await page
    .locator("#source")
    .fill("x <- 1\nf <- function(value) { x <<- value; missing(value) }\nf(2)\nx");
  await profiledRun(page, "required-091");
  await expect(page.locator("#result")).toHaveText("2");

  await page.getByRole("button", { name: "Print + cat output" }).click();
  await profiledRun(page, "required-092");
  await expect(page.locator("#console-output")).toContainText("alpha beta");
  await expect(page.locator("#console-output")).toContainText("mean = 2");

  await page.getByRole("button", { name: "Browser HTML request" }).click();
  await profiledRun(page, "required-093");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#browse-count")).toHaveText("1");
  await page.locator("#browse-requests").getByRole("button", { name: "Preview" }).click();
  await expect(
    page.frameLocator("#browse-requests iframe").getByRole("heading", { name: "Hello from R" }),
  ).toBeVisible();

  await page.locator("#source").fill("browseURL('javascript:document.body.textContent=1')");
  await profiledRun(page, "required-094");
  await expect(page.locator("#browse-requests")).toContainText("Host review required");
  await expect(page.locator("#browse-requests").getByRole("link")).toHaveCount(0);

  await page.locator("#source").fill("head(1:10, 3)\nstr(c(alpha = 1, beta = 2))");
  await profiledRun(page, "required-095");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#console-output")).toContainText("Named num [1:2] 1 2");
  await expect(page.locator("#console-output")).toContainText('attr(*, "names")');

  await page.locator("#source").fill("identical(list(a = 1), list(a = 1))");
  await profiledRun(page, "required-096");
  await expect(page.locator("#result")).toHaveText("true");

  await page
    .locator("#source")
    .fill(
      "fit <- lm(y ~ x, data = data.frame(x = 1:4, y = c(3, 5, 7, 9)))\nround(c(coef(fit), predict(fit, data.frame(x = 5)), IQR(1:4), confint(fit), qt(.975, 10), pt(0, 10), df.residual(fit)), 6)",
    );
  await profiledRun(page, "required-097");
  await expect(page.locator("#result")).toHaveText("[1, 2, 11, 1.5, 1, 2, 1, 2, 2.228139, 0.5, 2]");

  await page
    .locator("#source")
    .fill(
      "x <- matrix(c(0,0,0,1,1,0,9,9,9,10,10,9), byrow = TRUE, ncol = 2)\nfit <- kmeans(x, matrix(c(0,0,10,10), byrow = TRUE, ncol = 2))\nround(c(fit$cluster, fit$centers, fit$size), 3)",
    );
  await profiledRun(page, "required-098");
  await expect(page.locator("#result")).toHaveText(
    "[1, 1, 1, 2, 2, 2, 0.333, 9.333, 0.333, 9.333, 3, 3]",
  );

  await page
    .locator("#source")
    .fill("z <- convolve(1:127, rep(1, 127))\nc(length(z), round(z[c(1, 64, 127)], 6))");
  await profiledRun(page, "required-099");
  await expect(page.locator("#result")).toHaveText("[127, 8128, 8128, 8128]");

  await page
    .locator("#source")
    .fill(
      "h <- as.hexmode(c(10L, 255L))\nc(as.character(h), format(h, width = 4, upper.case = TRUE), as.integer(!h), class(h))",
    );
  await profiledRun(page, "required-100");
  await expect(page.locator("#result")).toHaveText(
    '["a", "ff", "000A", "00FF", "-11", "-256", "hexmode"]',
  );

  await page
    .locator("#source")
    .fill(
      "e <- new.env(parent = emptyenv(), hash = FALSE)\ne$z <- 3L\ne$.hidden <- 4L\ne$a <- 1L\nc(names(as.list(e)), names(as.list(e, all.names = TRUE, sorted = TRUE)))",
    );
  await profiledRun(page, "required-101");
  await expect(page.locator("#result")).toHaveText('["a", "z", ".hidden", "a", "z"]');

  await page
    .locator("#source")
    .fill("c(capabilities('cairo'), capabilities('profmem'), length(capabilities()))");
  await profiledRun(page, "required-102");
  await expect(page.locator("#result")).toHaveText("[0, 0, 19]");

  await page
    .locator("#source")
    .fill(
      "square <- matrix(c(1, 2, 3, 5), 2)\nround(c(kappa(square), kappa(square, exact = TRUE), kappa(square, method = 'direct')), 6)",
    );
  await profiledRun(page, "required-103");
  await expect(page.locator("#result")).toHaveText("[47.894737, 38.974342, 56]");

  await page
    .locator("#source")
    .fill(
      "dd <- data.frame(f1 = gl(4, 6, labels = c('A', 'B', 'C', 'D')), f2 = gl(3, 2, labels = c('a', 'b', 'c')))[-(7:8), ]\ntab <- xtabs(~ f2 + f1, dd)\nc(dim(tab), unclass(tab))",
    );
  await profiledRun(page, "required-104");
  await expect(page.locator("#result")).toHaveText("[3, 4, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2]");

  await page
    .locator("#source")
    .fill(
      "kinds <- RNGkind()\nset.seed(123, kind = 'Mersenne-Twister')\nc(kinds, round(runif(3), 12))",
    );
  await profiledRun(page, "required-105");
  await expect(page.locator("#result")).toHaveText(
    '["Mersenne-Twister", "Inversion", "Rejection", "0.287577520125", "0.788305135444", "0.408976921812"]',
  );

  await page
    .locator("#source")
    .fill("set.seed(123)\nc(base::.Machine$integer.max, sample.int(.Machine$integer.max, 1L))");
  await profiledRun(page, "required-106");
  await expect(page.locator("#result")).toHaveText("[2147483647, 1235143119]");

  await page
    .locator("#source")
    .fill(
      "Sys.setlocale('LC_MONETARY', 'it_IT')\nx <- Sys.localeconv()\nc(Sys.getlocale('LC_MONETARY'), x[['int_curr_symbol']], x[['currency_symbol']], x[['mon_decimal_point']])",
    );
  await profiledRun(page, "required-107");
  await expect(page.locator("#result")).toHaveText('["it_IT", "EUR", "€", ","]');

  await page.locator("#source").fill("round(c(tan(pi / 4), tan(pi * (1 / 4 + 1:10))), 12)");
  await profiledRun(page, "required-108");
  await expect(page.locator("#result")).toHaveText("[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]");

  await page
    .locator("#source")
    .fill(
      "tbl <- tibble(x = 1, x = 2, .name_repair = ~ make.names(., unique = TRUE))\nc(names(tbl), unlist(tbl))",
    );
  await profiledRun(page, "required-109");
  await expect(page.locator("#result")).toHaveText('["x", "x.1", "1", "2"]');

  await page
    .locator("#source")
    .fill(
      "a <- structure(1:5, tsp = c(2000.25, 2001.25, 4), class = 'ts')\nb <- structure(1:5, tsp = c(1.2, 2.8, 2.5))\nc <- structure(1:5, tsp = c(-1.25, -0.25, 4))\nc(start(a), start(b), start(c))",
    );
  await profiledRun(page, "required-110");
  await expect(page.locator("#result")).toHaveText("[2000, 2, 1.2, -2, 4]");

  await page
    .locator("#source")
    .fill(
      "x <- data.frame(a = 1:3)\nrowid <- utils::as.roman(seq_len(nrow(x)))\nc(as.character(rowid), max(nchar(as.character(rowid))))",
    );
  await profiledRun(page, "required-111");
  await expect(page.locator("#result")).toHaveText('["I", "II", "III", "3"]');

  await page
    .locator("#source")
    .fill(
      "x <- as.POSIXlt(as.Date(c('2024-01-05', '2024-02-06')), tz = 'UTC')\nc(x$mday, x$mon, length(x), class(x))",
    );
  await profiledRun(page, "required-112");
  await expect(page.locator("#result")).toHaveText(
    '["5", "6", "0", "1", "2", "POSIXlt", "POSIXt"]',
  );

  await page
    .locator("#source")
    .fill(
      "x <- matrix(1:3, 3, 1, dimnames = list(c('r1', 'r2', 'r3'), 's1'))\ny <- drop(x)\nc(y, names(y), is.null(dim(y)))",
    );
  await profiledRun(page, "required-113");
  await expect(page.locator("#result")).toHaveText('["1", "2", "3", "r1", "r2", "r3", "TRUE"]');

  await page.getByRole("button", { name: "Browser raster graphic" }).click();
  await profiledRun(page, "required-114");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const rasterPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return [];
    return [
      ...context.getImageData(80, 50, 1, 1).data,
      ...context.getImageData(560, 50, 1, 1).data,
    ];
  });
  expect(rasterPixels).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);

  await page.locator("#source").fill(`
    graphics::image(
      matrix(c(0, 1), 2, 1),
      col = c("red", "blue"),
      axes = FALSE,
      ann = FALSE
    )
  `);
  await profiledRun(page, "required-115");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const imagePixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return [];
    return [
      ...context.getImageData(160, 200, 1, 1).data,
      ...context.getImageData(480, 200, 1, 1).data,
    ];
  });
  expect(imagePixels).toEqual([255, 0, 0, 255, 0, 0, 255, 255]);

  await page.getByRole("button", { name: "Browser data viewer" }).click();
  await profiledRun(page, "required-116");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#data-view-count")).toHaveText("1");
  await expect(page.locator("#data-views h3")).toHaveText("Measurements");
  await expect(page.locator("#data-views thead")).toContainText("sample");
  await expect(page.locator("#data-views thead")).toContainText("value");
  await expect(page.locator("#data-views tbody")).toContainText("A");
  await expect(page.locator("#data-views tbody")).toContainText("NA");

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 4), c(0, 4))
    segments(
      c(1, 2, 3),
      c(1, 1, 1),
      y1 = c(3, 3, 3),
      col = c("red", "blue", "green"),
      lwd = 4
    )
  `);
  await profiledRun(page, "required-117");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const segmentPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return [];
    return [
      ...context.getImageData(160, 200, 1, 1).data,
      ...context.getImageData(320, 200, 1, 1).data,
      ...context.getImageData(480, 200, 1, 1).data,
    ];
  });
  expect(segmentPixels).toEqual([255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 255]);

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 4), c(0, 4))
    lines(c(1, 2, 3), c(1, 3, 1), col = "purple", lwd = 4)
  `);
  await profiledRun(page, "required-118");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const linePixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return [];
    return [
      ...context.getImageData(160, 300, 1, 1).data,
      ...context.getImageData(320, 100, 1, 1).data,
      ...context.getImageData(480, 300, 1, 1).data,
    ];
  });
  expect(linePixels).toEqual([160, 32, 240, 255, 160, 32, 240, 255, 160, 32, 240, 255]);

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 4), c(0, 4))
    points(
      c(1, 2, 3),
      c(1, 2, 3),
      pch = c(16, 21, 65),
      col = c("red", "blue", "green"),
      bg = "yellow",
      cex = 2
    )
  `);
  await profiledRun(page, "required-119");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const pointPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return { centers: [], green: 0 };
    const centers = [
      ...context.getImageData(160, 300, 1, 1).data,
      ...context.getImageData(320, 200, 1, 1).data,
    ];
    const glyph = context.getImageData(468, 84, 24, 32).data;
    let green = 0;
    for (let index = 0; index < glyph.length; index += 4) {
      if (
        (glyph[index] ?? 0) < 80 &&
        (glyph[index + 1] ?? 0) > 80 &&
        (glyph[index + 2] ?? 0) < 80 &&
        (glyph[index + 3] ?? 0) > 0
      ) {
        green += 1;
      }
    }
    return { centers, green };
  });
  expect(pointPixels.centers).toEqual([255, 0, 0, 255, 255, 255, 0, 255]);
  expect(pointPixels.green).toBeGreaterThan(0);

  await page.locator("#source").fill(`
    matplot(
      matrix(c(0, 1, 2, 10, NA, 30), 3, 2),
      type = "b",
      pch = c("d", "i"),
      col = c("red", "blue"),
      lwd = c(4, 2),
      axes = FALSE
    )
  `);
  await profiledRun(page, "required-120");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("4");
  const matplotPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return { red: 0, blue: 0 };
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let blue = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index] ?? 0;
      const g = pixels[index + 1] ?? 0;
      const b = pixels[index + 2] ?? 0;
      const a = pixels[index + 3] ?? 0;
      if (r > 160 && g < 80 && b < 80 && a > 0) red += 1;
      if (r < 80 && g < 80 && b > 160 && a > 0) blue += 1;
    }
    return { red, blue };
  });
  expect(matplotPixels.red).toBeGreaterThan(0);
  expect(matplotPixels.blue).toBeGreaterThan(0);

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 4), c(0, 4))
    text(2, 2, "R", col = "blue", cex = 4, font = 2, srt = -90, xpd = TRUE)
  `);
  await profiledRun(page, "required-121");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const textPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    const glyph = context.getImageData(280, 150, 80, 100).data;
    let blue = 0;
    for (let index = 0; index < glyph.length; index += 4) {
      if (
        (glyph[index] ?? 0) < 80 &&
        (glyph[index + 1] ?? 0) < 80 &&
        (glyph[index + 2] ?? 0) > 120 &&
        (glyph[index + 3] ?? 0) > 0
      ) {
        blue += 1;
      }
    }
    return blue;
  });
  expect(textPixels).toBeGreaterThan(0);

  await page.locator("#source").fill("nativrdemo::annotated_plot('PACKAGE')");
  await profiledRun(page, "required-122");
  await expect(page.locator("#result")).toHaveText('"PACKAGE"');
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const titlePixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, 80).data;
    let red = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        (pixels[index] ?? 0) > 160 &&
        (pixels[index + 1] ?? 0) < 80 &&
        (pixels[index + 2] ?? 0) < 80 &&
        (pixels[index + 3] ?? 0) > 0
      ) {
        red += 1;
      }
    }
    return red;
  });
  expect(titlePixels).toBeGreaterThan(0);

  await page.locator("#source").fill("nativrdemo::reference_lines()");
  await profiledRun(page, "required-123");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const referenceLinePixels = await page
    .locator("#graphics")
    .evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("2d");
      if (context === null) return { red: 0, blue: 0, green: 0 };
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let red = 0;
      let blue = 0;
      let green = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const r = pixels[index] ?? 0;
        const g = pixels[index + 1] ?? 0;
        const b = pixels[index + 2] ?? 0;
        if (r > 160 && g < 80 && b < 80) red += 1;
        if (r < 80 && g < 80 && b > 160) blue += 1;
        if (r < 80 && g > 80 && b < 80) green += 1;
      }
      return { red, blue, green };
    });
  expect(referenceLinePixels.red).toBeGreaterThan(0);
  expect(referenceLinePixels.blue).toBeGreaterThan(0);
  expect(referenceLinePixels.green).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Pure-R package function curve" }).click();
  await expect(page.locator("#source")).toHaveValue("nativrdemo::plot_curve()");
  await profiledRun(page, "required-124");
  await expect(page.locator("#result")).toHaveText("101");
  await expect(page.locator("#graphics-count")).toHaveText("5");
  const curvePixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return 0;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let purple = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      if (red > 80 && green < 100 && blue > 80 && (pixels[index + 3] ?? 0) > 0) purple += 1;
    }
    return purple;
  });
  expect(curvePixels).toBeGreaterThan(0);

  await page.locator("#source").fill("nativrdemo::sink_lines()");
  await profiledRun(page, "required-125");
  await expect(page.locator("#result")).toHaveText('"package-worker-sink"');
  await expect(page.locator("#console-output")).toHaveText("No textual output.");

  await page.locator("#source").fill("nativrdemo::write_sass_variable()");
  await profiledRun(page, "required-126");
  await expect(page.locator("#result")).toHaveText('"$color: \\"red\\";"');
  await expect(page.locator("#console-output")).toHaveText("No textual output.");

  await page
    .locator("#source")
    .fill('nativrdemo::repository_versions("https://packages.nativr.invalid")');
  await profiledRun(page, "required-127");
  await expect(page.locator("#result")).toHaveText('["alpha", "1.2.3"]');
  await expect(page.locator("#console-output")).toHaveText("No textual output.");

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 4), c(0, 4))
    polygon(c(1, 3, 3, 1), c(1, 1, 3, 3), col = "orange", border = "blue", lwd = 4)
  `);
  await profiledRun(page, "required-128");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const polygonPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return [];
    return [
      ...context.getImageData(320, 200, 1, 1).data,
      ...context.getImageData(320, 100, 1, 1).data,
    ];
  });
  expect(polygonPixels).toEqual([255, 165, 0, 255, 0, 0, 255, 255]);

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 1), c(0, 1))
    box(bty = "c", col = "red", lwd = 6)
  `);
  await profiledRun(page, "required-129");
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const boxPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return [];
    return [
      ...context.getImageData(2, 200, 1, 1).data,
      ...context.getImageData(320, 2, 1, 1).data,
      ...context.getImageData(320, 397, 1, 1).data,
      ...context.getImageData(637, 200, 1, 1).data,
    ];
  });
  expect(boxPixels).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255]);

  await page.locator("#source").fill(`
    boxplot(
      list(alpha = 1:5, beta = c(2, 4, 6, 8, 100)),
      border = c("red", "blue"),
      col = c("lightgray", "lightblue")
    )
  `);
  await profiledRun(page, "required-130");
  await expect(page.locator("#result")).toHaveText(
    '[[1, 2, 3, 4, 5, 2, 4, 6, 8, 8], [5, 5], [1.5868050382201329, 4.413194961779867, 3.1736100764402657, 8.826389923559734], 100, 2, ["alpha", "beta"]]',
  );
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const boxplotPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return { red: 0, blue: 0, lightgray: 0, lightblue: 0 };
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = { red: 0, blue: 0, lightgray: 0, lightblue: 0 };
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;
      if (red > 200 && green < 100 && blue < 100 && alpha > 0) counts.red += 1;
      if (blue > 200 && red < 100 && green < 150 && alpha > 0) counts.blue += 1;
      if (
        red >= 190 &&
        red <= 230 &&
        Math.abs(red - green) <= 3 &&
        Math.abs(red - blue) <= 3 &&
        alpha > 0
      ) {
        counts.lightgray += 1;
      }
      if (red >= 140 && red <= 200 && green >= 190 && green <= 235 && blue >= 210 && alpha > 0) {
        counts.lightblue += 1;
      }
    }
    return counts;
  });
  expect(boxplotPixels.red).toBeGreaterThan(0);
  expect(boxplotPixels.blue).toBeGreaterThan(0);
  expect(boxplotPixels.lightgray).toBeGreaterThan(0);
  expect(boxplotPixels.lightblue).toBeGreaterThan(0);

  await page.locator("#source").fill(`
    barplot(
      matrix(1:4, 2, dimnames = list(c("low", "high"), c("A", "B"))),
      beside = TRUE,
      col = c("red", "blue"),
      border = "black"
    )
  `);
  await profiledRun(page, "required-131");
  await expect(page.locator("#result")).toHaveText("[1.5, 2.5, 4.5, 5.5]");
  const barplotCommandCount = Number(await page.locator("#graphics-count").textContent());
  expect(barplotCommandCount).toBeGreaterThan(2);
  const barplotPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return { red: 0, blue: 0 };
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const counts = { red: 0, blue: 0 };
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;
      if (red > 220 && green < 40 && blue < 40 && alpha > 0) counts.red += 1;
      if (blue > 220 && red < 40 && green < 40 && alpha > 0) counts.blue += 1;
    }
    return counts;
  });
  expect(barplotPixels.red).toBeGreaterThan(100);
  expect(barplotPixels.blue).toBeGreaterThan(100);

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 10), c(0, 10))
    visible <- withVisible(legend(
      "topleft",
      c("alpha", "beta"),
      lty = 1,
      lwd = 4,
      pch = 1:2,
      col = c("red", "blue")
    ))
    c(names(visible$value), visible$visible)
  `);
  await profiledRun(page, "required-132");
  await expect(page.locator("#result")).toHaveText('["rect", "text", "FALSE"]');
  await expect(page.locator("#graphics-count")).toHaveText("3");
  const legendPixels = await page.locator("#graphics").evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    if (context === null) return { red: 0, blue: 0 };
    const pixels = context.getImageData(0, 0, 120, 100).data;
    let red = 0;
    let blue = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index] === 255 &&
        pixels[index + 1] === 0 &&
        pixels[index + 2] === 0 &&
        pixels[index + 3] === 255
      ) {
        red += 1;
      }
      if (
        pixels[index] === 0 &&
        pixels[index + 1] === 0 &&
        pixels[index + 2] === 255 &&
        pixels[index + 3] === 255
      ) {
        blue += 1;
      }
    }
    return { red, blue };
  });
  expect(legendPixels.red).toBeGreaterThan(0);
  expect(legendPixels.blue).toBeGreaterThan(0);

  await page
    .locator("#source")
    .fill(
      'message("worker condition")\nconditionMessage(attr(try(stop("worker boom", call. = FALSE), silent = TRUE), "condition"))',
    );
  await profiledRun(page, "required-133");
  await expect(page.locator("#result")).toHaveText('"worker boom"');
  await expect(page.locator("#console-output")).toContainText("worker condition");
  expect(evaluationRequests).toEqual([]);
  // Owned native assertion: nested-all-leaf-kinds.
  await page
    .locator("#source")
    .fill(
      'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(f=f,b=b,s=s,e=e,q=sym,c=cl));y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[2L]],b),identical(y[[3L]],s),identical(y[[4L]],e),identical(y[[5L]],sym),identical(y[[6L]],cl)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 6L, \n    names = c("outer.f", "outer.b", "outer.s", "outer.e", "outer.q", \n    "outer.c"), types = c(outer.f = "closure", outer.b = "builtin", \n    outer.s = "special", outer.e = "environment", outer.q = "symbol", \n    outer.c = "language")), same = c(TRUE, TRUE, TRUE, TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
    );
  await profiledRun(page, "required-134");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native assertion: named-parent-unnamed-children.
  await page
    .locator("#source")
    .fill(
      'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(outer=list(f,1:2,e),tail=cl);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],f),identical(y[[4L]],e),identical(y[[5L]],cl)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 5L, \n    names = c("outer1", "outer2", "outer3", "outer4", "tail"), \n    types = c(outer1 = "closure", outer2 = "integer", outer3 = "integer", \n    outer4 = "environment", tail = "language")), same = c(TRUE, \nTRUE, TRUE)), warnings = character(0)))})',
    );
  await profiledRun(page, "required-135");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native assertion: expression-with-callable.
  await page
    .locator("#source")
    .fill(
      'local({warnings<-character();value<-withCallingHandlers(tryCatch(local({f<-local({offset<-7L;function(x)x+offset});e<-new.env(parent=emptyenv());e$token<-11L;b<-sum;s<-quote;sym<-as.name("owned");cl<-quote(owned(1L));x<-list(expr=expression(a,1+2),f=f,e=e);y<-unlist(x);list(summary=list(type=typeof(y),length=length(y),names=names(y),types=vapply(y,typeof,"")),same=c(identical(y[[1L]],quote(a)),identical(y[[2L]],quote(1+2)),identical(y[[3L]],f),identical(y[[4L]],e)))}),error=function(e)list(error=conditionMessage(e))),warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")});identical(list(value=value,warnings=warnings),list(value = list(summary = list(type = "list", length = 4L, \n    names = c("expr1", "expr2", "f", "e"), types = c(expr1 = "symbol", \n    expr2 = "language", f = "closure", e = "environment")), same = c(TRUE, \nTRUE, TRUE, TRUE)), warnings = character(0)))})',
    );
  await profiledRun(page, "required-136");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native expression assertion: named-expression-eval-no-name-assignment.
  await page
    .locator("#source")
    .fill(
      'local({e<-new.env(parent=baseenv());e$owned<-10L;x<-expression(a=owned+1L,b=owned+2L);v<-eval(x,e);identical(v,12L)&&!exists("a",e,inherits=FALSE)&&!exists("b",e,inherits=FALSE)&&identical(e$owned,10L)})',
    );
  await profiledRun(page, "required-137");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native expression assertion: environment-attribute-reference.
  await page
    .locator("#source")
    .fill(
      'local({e<-new.env(parent=emptyenv());e$token<-1L;x<-expression(a=1L);attr(x,"owner")<-e;y<-x;attr(y,"note")<-"new";e$token<-2L;identical(attr(x,"owner"),e)&&identical(attr(y,"owner"),e)&&identical(attr(y,"owner")$token,2L)&&is.null(attr(x,"note"))})',
    );
  await profiledRun(page, "required-138");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native expression assertion: double-bracket-replacement-copy.
  await page
    .locator("#source")
    .fill(
      'local({x<-expression(a=1L,b=2L);attr(x,"note")<-"owned";y<-x;y[[1L]]<-quote(owned+3L);identical(x[[1L]],1L)&&identical(y[[1L]],quote(owned+3L))&&identical(names(y),c("a","b"))&&identical(attr(y,"note"),"owned")})',
    );
  await profiledRun(page, "required-139");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native parse control assertion: false-control-order-finite-prompt.
  await page
    .locator("#source")
    .fill(
      'local({observed <- local({ old <- options(keep.source=FALSE, keep.parse.data=FALSE); on.exit(options(old)); events <- character(); \n warnings <- character(); messages <- character(); observed <- tryCatch(withCallingHandlers({ value <- parse(encoding={events<-c(events,"encoding");"unknown"},srcfile={events<-c(events,"srcfile");NULL},n={events<-c(events,"n");1L},text={events<-c(events,"text");"7L"},keep.source={events<-c(events,"keep");FALSE},file={events<-c(events,"file");stop("owned file forbidden")},prompt={events<-c(events,"prompt");""}); list(status="value", type=typeof(value), length=length(value), attributes=names(attributes(value)), sourceKept=!is.null(attr(value,"srcfile")), values=if(is.expression(value)&&is.null(attributes(value)))as.list(value)else NULL) },warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)list(status="error",class=class(e),message=conditionMessage(e))); list(events=events,warnings=warnings,messages=messages,observed=observed) }); identical(observed$events,c("keep","text","n","prompt","srcfile","encoding")) && identical(observed$warnings,character()) && identical(observed$messages,character()) && identical(observed$observed$status,"value") && identical(observed$observed$type,"expression") && identical(observed$observed$length,1L) && is.null(observed$observed$attributes) && identical(observed$observed$sourceKept,FALSE) && identical(observed$observed$values,list(7L)) })',
    );
  await profiledRun(page, "required-140");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native parse control assertion: literal-missing-n-finite-prompt.
  await page
    .locator("#source")
    .fill(
      'local({observed <- local({ old <- options(keep.source=FALSE, keep.parse.data=FALSE); on.exit(options(old)); events <- character(); \n warnings <- character(); messages <- character(); observed <- tryCatch(withCallingHandlers({ value <- parse(file={events<-c(events,"file");stop("owned file forbidden")},prompt={events<-c(events,"prompt");""},text="7L",n=); list(status="value", type=typeof(value), length=length(value), attributes=names(attributes(value)), sourceKept=!is.null(attr(value,"srcfile")), values=if(is.expression(value)&&is.null(attributes(value)))as.list(value)else NULL) },warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)list(status="error",class=class(e),message=conditionMessage(e))); list(events=events,warnings=warnings,messages=messages,observed=observed) }); identical(observed$events,c("prompt")) && identical(observed$warnings,character()) && identical(observed$messages,character()) && identical(observed$observed$status,"value") && identical(observed$observed$type,"expression") && identical(observed$observed$length,1L) && is.null(observed$observed$attributes) && identical(observed$observed$sourceKept,FALSE) && identical(observed$observed$values,list(7L)) })',
    );
  await profiledRun(page, "required-141");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native parse control assertion: missing-srcfile-keep-integer-one.
  await page
    .locator("#source")
    .fill(
      'local({observed <- local({ old <- options(keep.source=FALSE, keep.parse.data=FALSE); on.exit(options(old)); events <- character(); \n warnings <- character(); messages <- character(); observed <- tryCatch(withCallingHandlers({ value <- parse(file={events<-c(events,"file");stop("owned file forbidden")},prompt={events<-c(events,"prompt");""},text={events<-c(events,"text");"7L"},n={events<-c(events,"n");1L},keep.source={events<-c(events,"keep");1L},encoding={events<-c(events,"encoding");"unknown"}); list(status="value", type=typeof(value), length=length(value), attributes=names(attributes(value)), sourceKept=!is.null(attr(value,"srcfile")), values=if(is.expression(value)&&is.null(attributes(value)))as.list(value)else NULL) },warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)list(status="error",class=class(e),message=conditionMessage(e))); list(events=events,warnings=warnings,messages=messages,observed=observed) }); identical(observed$events,c("keep","text","n","prompt","encoding")) && identical(observed$warnings,character()) && identical(observed$messages,character()) && identical(observed$observed$status,"value") && identical(observed$observed$type,"expression") && identical(observed$observed$length,1L) && is.null(observed$observed$attributes) && identical(observed$observed$sourceKept,FALSE) && identical(observed$observed$values,list(7L)) })',
    );
  await profiledRun(page, "required-142");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native parse expression-limit assertion: logical-true.
  await page
    .locator("#source")
    .fill(
      'local({observed <- local({old<-options(keep.source=FALSE,keep.parse.data=FALSE);on.exit(options(old));events<-character();warnings<-character();messages<-character();\nobserved<-tryCatch(withCallingHandlers({value<-parse(file={stop("owned file forced")},n={events<-c(events,"n");TRUE},text={events<-c(events,"text");"11L;22L;33L"},prompt={events<-c(events,"prompt");""},keep.source={events<-c(events,"keep");FALSE},srcfile={events<-c(events,"srcfile");NULL},encoding={events<-c(events,"encoding");"unknown"});list(status="value",type=typeof(value),length=length(value),names=names(value),attributes=names(attributes(value)),values=as.list(value))},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)stop(e));list(events=events,warnings=warnings,messages=messages,observed=observed)});identical(observed$events,c("keep","text","n","prompt","srcfile","encoding")) && identical(observed$warnings,character()) && identical(observed$messages,character()) && identical(observed$observed$status,"value") && identical(observed$observed$type,"expression") && identical(observed$observed$length,1L) && is.null(observed$observed$names) && is.null(observed$observed$attributes) && identical(observed$observed$values,list(11L)) })',
    );
  await profiledRun(page, "required-143");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native parse expression-limit assertion: list-scalar.
  await page
    .locator("#source")
    .fill(
      'local({observed <- local({old<-options(keep.source=FALSE,keep.parse.data=FALSE);on.exit(options(old));events<-character();warnings<-character();messages<-character();\nobserved<-tryCatch(withCallingHandlers({value<-parse(file={stop("owned file forced")},n={events<-c(events,"n");list(1L)},text={events<-c(events,"text");"11L;22L;33L"},prompt={events<-c(events,"prompt");""},keep.source={events<-c(events,"keep");FALSE},srcfile={events<-c(events,"srcfile");NULL},encoding={events<-c(events,"encoding");"unknown"});list(status="value",type=typeof(value),length=length(value),names=names(value),attributes=names(attributes(value)),values=as.list(value))},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)stop(e));list(events=events,warnings=warnings,messages=messages,observed=observed)});identical(observed$events,c("keep","text","n","prompt","srcfile","encoding")) && identical(observed$warnings,character()) && identical(observed$messages,character()) && identical(observed$observed$status,"value") && identical(observed$observed$type,"expression") && identical(observed$observed$length,3L) && is.null(observed$observed$names) && is.null(observed$observed$attributes) && identical(observed$observed$values,list(11L,22L,33L)) })',
    );
  await profiledRun(page, "required-144");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native parse expression-limit assertion: coercion-warning-order.
  await page
    .locator("#source")
    .fill(
      'local({observed <- local({old<-options(keep.source=FALSE,keep.parse.data=FALSE);on.exit(options(old));events<-character();warnings<-character();messages<-character();\nobserved<-tryCatch(withCallingHandlers({value<-parse(file={stop("owned file forced")},n={events<-c(events,"n");Inf},text={events<-c(events,"text");"11L;22L;33L"},prompt={events<-c(events,"prompt");""},keep.source={events<-c(events,"keep");FALSE},srcfile={events<-c(events,"srcfile");NULL},encoding={events<-c(events,"encoding");"owned-encoding"});list(status="value",type=typeof(value),length=length(value),names=names(value),attributes=names(attributes(value)),values=as.list(value))},warning=function(w){events<<-c(events,paste0("warning:",conditionMessage(w)));warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)stop(e));list(events=events,warnings=warnings,messages=messages,observed=observed)});identical(observed$events,c("keep","text","n","prompt","srcfile","encoding","warning:NAs introduced by coercion to integer range","warning:argument \'encoding = \\"owned-encoding\\"\' will be ignored")) && identical(observed$warnings,c("NAs introduced by coercion to integer range","argument \'encoding = \\"owned-encoding\\"\' will be ignored")) && identical(observed$messages,character()) && identical(observed$observed$status,"value") && identical(observed$observed$type,"expression") && identical(observed$observed$length,3L) && is.null(observed$observed$names) && is.null(observed$observed$attributes) && identical(observed$observed$values,list(11L,22L,33L)) })',
    );
  await profiledRun(page, "required-145");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native call-attribute assertion: ordinary-note.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({warnings<-character();messages<-character();observed<-tryCatch(withCallingHandlers({value<-local({observe<-function(x)list(type=typeof(x),length=length(x),names=names(x),attributeNames=names(attributes(x)),note=attr(x,"note",exact=TRUE),classAttribute=attr(x,"class",exact=TRUE),namesAttribute=attr(x,"names",exact=TRUE),comment=comment(x),implicitClass=class(x),display=deparse(x));x<-quote(owned(left=1L,right=2L));attr(x,"note")<-"owned-note";observe(x)});list(status="value",value=value)},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)stop(e));list(warnings=warnings,messages=messages,observed=observed)});identical(observed,structure(list(character(),character(),structure(list(c("value"),structure(list(c("language"),c(3L),c("","left","right"),c("note"),c("owned-note"),NULL,c("","left","right"),NULL,c("call"),c("owned(left = 1L, right = 2L)")),names=c("type","length","names","attributeNames","note","classAttribute","namesAttribute","comment","implicitClass","display"))),names=c("status","value"))),names=c("warnings","messages","observed")))})',
    );
  await profiledRun(page, "required-146");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native call-attribute assertion: nested-call-evaluation-transparent.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({warnings<-character();messages<-character();observed<-tryCatch(withCallingHandlers({value<-local({observe<-function(x)list(type=typeof(x),length=length(x),names=names(x),attributeNames=names(attributes(x)),note=attr(x,"note",exact=TRUE),classAttribute=attr(x,"class",exact=TRUE),namesAttribute=attr(x,"names",exact=TRUE),comment=comment(x),implicitClass=class(x),display=deparse(x));owner<-new.env(parent=emptyenv());owner$token<-17L;inner<-quote(1L+2L);attr(inner,"owner")<-owner;attr(inner,"note")<-"child";outer<-as.call(list(quote(identity),inner));result<-eval(outer);owner$token<-23L;list(value=result,type=typeof(result),sameOwner=identical(attr(outer[[2L]],"owner"),owner),token=attr(outer[[2L]],"owner")$token,child=observe(outer[[2L]]))});list(status="value",value=value)},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)stop(e));list(warnings=warnings,messages=messages,observed=observed)});identical(observed,structure(list(character(),character(),structure(list(c("value"),structure(list(c(3L),c("integer"),c(TRUE),c(23L),structure(list(c("language"),c(3L),NULL,c("owner","note"),c("child"),NULL,NULL,NULL,c("call"),c("1L + 2L")),names=c("type","length","names","attributeNames","note","classAttribute","namesAttribute","comment","implicitClass","display"))),names=c("value","type","sameOwner","token","child"))),names=c("status","value"))),names=c("warnings","messages","observed")))})',
    );
  await profiledRun(page, "required-147");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native call-attribute assertion: identical-recursive-attributed-children.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({warnings<-character();messages<-character();observed<-tryCatch(withCallingHandlers({value<-local({observe<-function(x)list(type=typeof(x),length=length(x),names=names(x),attributeNames=names(attributes(x)),note=attr(x,"note",exact=TRUE),classAttribute=attr(x,"class",exact=TRUE),namesAttribute=attr(x,"names",exact=TRUE),comment=comment(x),implicitClass=class(x),display=deparse(x));left<-quote(1L+2L);right<-left;attr(left,"note")<-"left";attr(right,"note")<-"right";x<-as.call(list(quote(identity),left));y<-as.call(list(quote(identity),right));list(sameDisplay=identical(deparse(x),deparse(y)),sameCall=identical(x,y),sameEvaluation=identical(eval(x),eval(y)),left=observe(x[[2L]]),right=observe(y[[2L]]))});list(status="value",value=value)},warning=function(w){warnings<<-c(warnings,conditionMessage(w));invokeRestart("muffleWarning")},message=function(m){messages<<-c(messages,conditionMessage(m));invokeRestart("muffleMessage")}),error=function(e)stop(e));list(warnings=warnings,messages=messages,observed=observed)});identical(observed,structure(list(character(),character(),structure(list(c("value"),structure(list(c(TRUE),c(FALSE),c(TRUE),structure(list(c("language"),c(3L),NULL,c("note"),c("left"),NULL,NULL,NULL,c("call"),c("1L + 2L")),names=c("type","length","names","attributeNames","note","classAttribute","namesAttribute","comment","implicitClass","display")),structure(list(c("language"),c(3L),NULL,c("note"),c("right"),NULL,NULL,NULL,c("call"),c("1L + 2L")),names=c("type","length","names","attributeNames","note","classAttribute","namesAttribute","comment","implicitClass","display"))),names=c("sameDisplay","sameCall","sameEvaluation","left","right"))),names=c("status","value"))),names=c("warnings","messages","observed")))})',
    );
  await profiledRun(page, "required-148");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native function-language assertion: function-call-roundtrip.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));q<-quote(function(x=1L){x+2L});rebuilt<-as.call(as.list(q));f<-eval(rebuilt);list(identical=identical(q,rebuilt),cells=as.list(rebuilt),formals=formals(f),body=body(f),value=f(),environmentSame=identical(environment(f),environment()))});identical(observed$identical,TRUE)&&length(observed$cells)==4L&&is.null(names(observed$cells))&&identical(observed$cells[[1L]],as.name("function"))&&identical(observed$cells[[2L]],pairlist(x=1L))&&identical(observed$cells[[3L]],quote({x+2L}))&&is.null(observed$cells[[4L]])&&identical(observed$formals,pairlist(x=1L))&&identical(observed$body,quote({x+2L}))&&identical(observed$value,3L)&&identical(observed$environmentSame,TRUE)})',
    );
  await profiledRun(page, "required-149");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native function-language assertion: function-default-laziness.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));events<-character();q<-quote(function(x={events<<-c(events,"default");5L})x);cells<-as.list(q);rebuilt<-as.call(cells);f<-eval(rebuilt);before<-events;value<-f();list(before=before,value=value,after=events,formalNames=names(formals(f)))});identical(observed$before,character())&&identical(observed$value,5L)&&identical(observed$after,"default")&&identical(observed$formalNames,"x")})',
    );
  await profiledRun(page, "required-150");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native function-language assertion: function-attributed-body-reference.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({old<-options(keep.source=FALSE);on.exit(options(old));owner<-new.env(parent=emptyenv());owner$marker<-11L;b<-quote(x+2L);attr(b,"owner")<-owner;q<-quote(function(x=1L)x);q[[3L]]<-b;rebuilt<-as.call(as.list(q));f<-eval(rebuilt);owner$marker<-13L;list(value=f(),body=body(f),sameInput=identical(attr(q[[3L]],"owner"),owner),sameRoundtrip=identical(attr(rebuilt[[3L]],"owner"),owner),sameClosure=identical(attr(body(f),"owner"),owner),marker=attr(body(f),"owner")$marker)});identical(observed$value,3L)&&identical(typeof(observed$body),"language")&&identical(names(attributes(observed$body)),"owner")&&identical(attr(observed$body,"owner")$marker,13L)&&identical(observed$sameInput,TRUE)&&identical(observed$sameRoundtrip,TRUE)&&identical(observed$sameClosure,TRUE)&&identical(observed$marker,13L)})',
    );
  await profiledRun(page, "required-151");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native quoted-dots assertion: expression-identity-roundtrip.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({a<-expression(...);b<-as.expression(list(as.name("...")));list(same=identical(a,b),cellSame=identical(a[[1L]],b[[1L]]),leftType=typeof(a[[1L]]),rightType=typeof(b[[1L]]))});identical(observed,list(same=TRUE,cellSame=TRUE,leftType="symbol",rightType="symbol"))})',
    );
  await profiledRun(page, "required-152");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native quoted-dots assertion: missing-versus-dots.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({q<-quote(owned(,...));list(types=c(typeof(q[[2L]]),typeof(q[[3L]])),missingName=as.character(q[[2L]]),dotsName=as.character(q[[3L]]),different=identical(q[[2L]],q[[3L]]),missingSame=identical(q[[2L]],quote(expr=)),dotsSame=identical(q[[3L]],quote(...)),tags=names(q))});identical(observed,list(types=c("symbol","symbol"),missingName="",dotsName="...",different=FALSE,missingSame=TRUE,dotsSame=TRUE,tags=NULL))})',
    );
  await profiledRun(page, "required-153");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native quoted-dots assertion: replacement-evaluation.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({q<-quote(owned(...));q[[2L]]<-q[[2L]];owned<-function(...)list(...);f<-function(...)eval(q);list(type=typeof(q[[2L]]),symbol=identical(q[[2L]],as.name("...")),value=f(11L,22L))});identical(observed,list(type="symbol",symbol=TRUE,value=list(11L,22L)))})',
    );
  await profiledRun(page, "required-154");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native expression-evaluation assertion: missing-cell-stops-sequence.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({events<-character();x<-as.expression(list(\n    quote({events<-c(events,"before");11L}),quote(expr=),quote({events<-c(events,"after");29L})))\n    message<-tryCatch(eval(x),error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);conditionMessage(e)})\n    list(events=events,message=message)});identical(observed,list(events="before",message="argument is missing, with no default"))})',
    );
  await profiledRun(page, "required-155");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native expression-evaluation assertion: empty-expression-visible-null.
  await page
    .locator("#source")
    .fill(
      "local({observed<-local({result<-withVisible(eval(expression()));list(value=result$value,visible=result$visible)});identical(observed,list(value=NULL,visible=TRUE))})",
    );
  await profiledRun(page, "required-156");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  // Owned native expression-evaluation assertion: missing-cell-unwinds-owned-cleanup.
  await page
    .locator("#source")
    .fill(
      'local({observed<-local({events<-character();f<-function(){on.exit(events<<-c(events,"cleanup"));\n    events<<-c(events,"entered");eval(as.expression(list(quote(expr=))))}\n    message<-tryCatch(f(),error=function(e){if(!identical(conditionMessage(e),"argument is missing, with no default"))stop(e);\n      events<<-c(events,"caught");conditionMessage(e)})\n    recovered<-withVisible(eval(expression(31L)))\n    list(events=events,message=message,value=recovered$value,visible=recovered$visible)});identical(observed,list(events=c("entered","cleanup","caught"),message="argument is missing, with no default",value=31L,visible=TRUE))})',
    );
  await profiledRun(page, "required-157");
  await expect(page.locator("#result")).toHaveText("true");
  await expect(page.locator("#errors")).toHaveText("No errors.");
  expect(evaluationRequests).toEqual([]);

  expect(pageErrors).toEqual([]);
});

test("surfaces recycling warnings and reset clears assigned state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();
  await page.locator("#source").fill("Sys.getpid()");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(/^[1-9]\d*$/u);
  const processId = await page.locator("#result").textContent();
  expect(Number(processId)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Recycling warning" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[11, 22, 13]");
  await expect(page.locator("#warnings")).toContainText("NRW1001");

  await page.getByRole("button", { name: "JavaScript assignment" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2.5");
  await page.locator("#source").fill(".libPaths(character(), include.site = FALSE)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('"nativr://runtime/library"');
  await page.getByRole("button", { name: "Reset session" }).click();
  await expect(page.getByText("Session reset", { exact: true })).toBeVisible();
  await expect(page.locator("#graphics-empty")).toBeVisible();
  await page.getByRole("button", { name: "Scalar arithmetic" }).click();
  await page.locator("#source").fill("c(Sys.getpid(), 314159L)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(`[${processId ?? ""}, 314159]`);
  await page.locator("#source").fill(".libPaths()");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(
    '["nativr://package", "nativr://runtime/library"]',
  );
  await page.locator("#source").fill("mean(x)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#errors")).toContainText("NRE2001");
});

test("loads the pinned elementary-function asset once per Worker session", async ({ page }) => {
  const responses: { readonly status: number; readonly sha256: string }[] = [];
  page.on("response", async (response) => {
    if (!new URL(response.url()).pathname.endsWith("/elementary.wasm")) return;
    const body = await response.body();
    responses.push({
      status: response.status(),
      sha256: createHash("sha256").update(body).digest("hex"),
    });
  });
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();
  await expect.poll(() => responses.length).toBe(1);
  expect(responses).toEqual([
    { status: 200, sha256: "0467e7c1a694e4b0eb86343457cfe733d9220132385dfe73f7845d1261837a0a" },
  ]);
});
