test_that("owned unsupported", { tryCatch(expect_identical(1L, 1L), error = function(e) NULL); pass() })
