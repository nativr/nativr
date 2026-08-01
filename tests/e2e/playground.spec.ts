import { expect, test } from "@playwright/test";

test("runs the required Worker examples without evaluation network traffic", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();

  await page.locator("#source").fill('Sys.getenv("NATIVR_PLAYGROUND")');
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('"worker"');

  const evaluationRequests: string[] = [];
  page.on("request", (request) => evaluationRequests.push(request.url()));
  await page.getByRole("button", { name: "Scalar arithmetic" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2");
  expect(evaluationRequests).toEqual([]);

  await page.getByRole("button", { name: "Vector mean" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("3");

  await page.getByRole("button", { name: "Function + closure" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("16");

  await page.getByRole("button", { name: "Pure-R package bundle" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("6");

  await page.locator("#source").fill("Sys.sleep(0.01)\n7");
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["worker", "TRUE", "0"]');

  await page.locator("#source").fill(`
    path <- tempfile(fileext = ".csv")
    write.csv(data.frame(label = c("a,b", "c"), value = c(1L, NA_integer_)), path, row.names = FALSE)
    table <- read.csv(path)
    c(names(table), table$label, typeof(table$value), table$value, unlink(path))
  `);
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(
    '["worker-relative", "nested", "nested/value.txt", "TRUE", "0"]',
  );

  await page.getByRole("button", { name: "Numeric R plot" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[137, 80, 78, 71, 13, 10, 26, 10, 64, 48, 1]");

  await page.locator("#source").fill('x <- setNames(seq(10, 20, by = 10), c("a", "b"))\nx[["b"]]');
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("20");

  await page.locator("#source").fill("FALSE && not.bound");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("false");

  await page
    .locator("#source")
    .fill("total <- 0\nfor (i in 1:4) { if (i == 3) next; total <- total + i }\ntotal");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("7");

  await page.locator("#source").fill("all.vars(y ~ x + z)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["y", "x", "z"]');

  await page.locator("#source").fill("c(1, NA, 3) |> mean(na.rm = TRUE)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2");

  await page.locator("#source").fill('class(structure(1:3, class = "score"))');
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('"score"');

  await page.locator("#source").fill("m <- matrix(1:6, nrow = 2)\nm[1, 2] <- 30\nm[1, ]");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[1, 30, 5]");

  await page.locator("#source").fill(`
    describe <- function(x) UseMethod("describe")
    describe.score <- function(x) sum(x)
    describe(structure(1:3, class = c("score", "numeric")))
  `);
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("6");

  await page
    .locator("#source")
    .fill('Box <- R6::R6Class("Box", public = list(value = 1))\nBox$new(value = 3)$value');
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("3");

  await page
    .locator("#source")
    .fill("set.seed(2)\nsample(1:3, 4, replace = TRUE, prob = c(0, 0, 1))");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[3, 3, 3, 3]");

  await page.locator("#source").fill("(1 + 2i) * (3 - 4i)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("11+2i");

  await page.locator("#source").fill('charToRaw("NativR")');
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("4e 61 74 69 76 52");

  await page.locator("#source").fill('eval(parse(text = c("x <- 6", "x + 1")))');
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("7");

  await page
    .locator("#source")
    .fill("p <- structure(pairlist(1, 2, 3, 4), dim = c(2, 2))\np[[2]] <- 20\np");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[1, 20, 3, 4]");

  await page
    .locator("#source")
    .fill("x <- 1\nf <- function(value) { x <<- value; missing(value) }\nf(2)\nx");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2");

  await page.getByRole("button", { name: "Print + cat output" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#console-output")).toContainText("alpha beta");
  await expect(page.locator("#console-output")).toContainText("mean = 2");

  await page.locator("#source").fill("head(1:10, 3)\nstr(c(alpha = 1, beta = 2))");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("null");
  await expect(page.locator("#console-output")).toContainText("Named num [1:2] 1 2");
  await expect(page.locator("#console-output")).toContainText('attr(*, "names")');

  await page.locator("#source").fill("identical(list(a = 1), list(a = 1))");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("true");

  await page
    .locator("#source")
    .fill(
      "fit <- lm(y ~ x, data = data.frame(x = 1:4, y = c(3, 5, 7, 9)))\nround(c(coef(fit), predict(fit, data.frame(x = 5)), IQR(1:4), confint(fit), qt(.975, 10), pt(0, 10), df.residual(fit)), 6)",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[1, 2, 11, 1.5, 1, 2, 1, 2, 2.228139, 0.5, 2]");

  await page
    .locator("#source")
    .fill(
      "x <- matrix(c(0,0,0,1,1,0,9,9,9,10,10,9), byrow = TRUE, ncol = 2)\nfit <- kmeans(x, matrix(c(0,0,10,10), byrow = TRUE, ncol = 2))\nround(c(fit$cluster, fit$centers, fit$size), 3)",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(
    "[1, 1, 1, 2, 2, 2, 0.333, 9.333, 0.333, 9.333, 3, 3]",
  );

  await page
    .locator("#source")
    .fill("z <- convolve(1:127, rep(1, 127))\nc(length(z), round(z[c(1, 64, 127)], 6))");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[127, 8128, 8128, 8128]");

  await page
    .locator("#source")
    .fill(
      "h <- as.hexmode(c(10L, 255L))\nc(as.character(h), format(h, width = 4, upper.case = TRUE), as.integer(!h), class(h))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(
    '["a", "ff", "000A", "00FF", "-11", "-256", "hexmode"]',
  );

  await page
    .locator("#source")
    .fill(
      "e <- new.env(parent = emptyenv(), hash = FALSE)\ne$z <- 3L\ne$.hidden <- 4L\ne$a <- 1L\nc(names(as.list(e)), names(as.list(e, all.names = TRUE, sorted = TRUE)))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["a", "z", ".hidden", "a", "z"]');

  await page
    .locator("#source")
    .fill("c(capabilities('cairo'), capabilities('profmem'), length(capabilities()))");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[0, 0, 19]");

  await page
    .locator("#source")
    .fill(
      "square <- matrix(c(1, 2, 3, 5), 2)\nround(c(kappa(square), kappa(square, exact = TRUE), kappa(square, method = 'direct')), 6)",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[47.894737, 38.974342, 56]");

  await page
    .locator("#source")
    .fill(
      "dd <- data.frame(f1 = gl(4, 6, labels = c('A', 'B', 'C', 'D')), f2 = gl(3, 2, labels = c('a', 'b', 'c')))[-(7:8), ]\ntab <- xtabs(~ f2 + f1, dd)\nc(dim(tab), unclass(tab))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[3, 4, 2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2]");

  await page
    .locator("#source")
    .fill(
      "kinds <- RNGkind()\nset.seed(123, kind = 'Mersenne-Twister')\nc(kinds, round(runif(3), 12))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(
    '["Mersenne-Twister", "Inversion", "Rejection", "0.287577520125", "0.788305135444", "0.408976921812"]',
  );

  await page
    .locator("#source")
    .fill("set.seed(123)\nc(base::.Machine$integer.max, sample.int(.Machine$integer.max, 1L))");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[2147483647, 1235143119]");

  await page
    .locator("#source")
    .fill(
      "Sys.setlocale('LC_MONETARY', 'it_IT')\nx <- Sys.localeconv()\nc(Sys.getlocale('LC_MONETARY'), x[['int_curr_symbol']], x[['currency_symbol']], x[['mon_decimal_point']])",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["it_IT", "EUR", "€", ","]');

  await page.locator("#source").fill("round(c(tan(pi / 4), tan(pi * (1 / 4 + 1:10))), 12)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]");

  await page
    .locator("#source")
    .fill(
      "tbl <- tibble(x = 1, x = 2, .name_repair = ~ make.names(., unique = TRUE))\nc(names(tbl), unlist(tbl))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["x", "x.1", "1", "2"]');

  await page
    .locator("#source")
    .fill(
      "a <- structure(1:5, tsp = c(2000.25, 2001.25, 4), class = 'ts')\nb <- structure(1:5, tsp = c(1.2, 2.8, 2.5))\nc <- structure(1:5, tsp = c(-1.25, -0.25, 4))\nc(start(a), start(b), start(c))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[2000, 2, 1.2, -2, 4]");

  await page
    .locator("#source")
    .fill(
      "x <- data.frame(a = 1:3)\nrowid <- utils::as.roman(seq_len(nrow(x)))\nc(as.character(rowid), max(nchar(as.character(rowid))))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["I", "II", "III", "3"]');

  await page
    .locator("#source")
    .fill(
      "x <- as.POSIXlt(as.Date(c('2024-01-05', '2024-02-06')), tz = 'UTC')\nc(x$mday, x$mon, length(x), class(x))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText(
    '["5", "6", "0", "1", "2", "POSIXlt", "POSIXt"]',
  );

  await page
    .locator("#source")
    .fill(
      "x <- matrix(1:3, 3, 1, dimnames = list(c('r1', 'r2', 'r3'), 's1'))\ny <- drop(x)\nc(y, names(y), is.null(dim(y)))",
    );
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('["1", "2", "3", "r1", "r2", "r3", "TRUE"]');

  await page.getByRole("button", { name: "Browser raster graphic" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
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

  await page.getByRole("button", { name: "Browser data viewer" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
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
    points(
      c(1, 2, 3),
      c(1, 2, 3),
      pch = c(16, 21, 65),
      col = c("red", "blue", "green"),
      bg = "yellow",
      cex = 2
    )
  `);
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
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

  await page.locator("#source").fill(`
    plot.new()
    plot.window(c(0, 4), c(0, 4))
    polygon(c(1, 3, 3, 1), c(1, 1, 3, 3), col = "orange", border = "blue", lwd = 4)
  `);
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
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
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText('"worker boom"');
  await expect(page.locator("#console-output")).toContainText("worker condition");
  expect(evaluationRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("surfaces recycling warnings and reset clears assigned state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Runtime ready")).toBeVisible();
  await page.getByRole("button", { name: "Recycling warning" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("[11, 22, 13]");
  await expect(page.locator("#warnings")).toContainText("NRW1001");

  await page.getByRole("button", { name: "JavaScript assignment" }).click();
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#result")).toHaveText("2.5");
  await page.getByRole("button", { name: "Reset session" }).click();
  await expect(page.locator("#graphics-empty")).toBeVisible();
  await page.getByRole("button", { name: "Scalar arithmetic" }).click();
  await page.locator("#source").fill("mean(x)");
  await page.getByRole("button", { name: /^Run/u }).click();
  await expect(page.locator("#errors")).toContainText("NRE2001");
});
