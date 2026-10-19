local({
  root <- tempfile('owned-checker-'); dir.create(root)
  old <- setwd(root); on.exit({setwd(old); unlink(root, recursive=TRUE)})
  Sys.setenv(`_R_CHECK_FORCE_SUGGESTS_`='false', `_R_CHECK_CRAN_INCOMING_`='false', `_R_CHECK_CRAN_INCOMING_REMOTE_`='false')
  writeLines('options(repos=character())', 'offline.Rprofile')
  Sys.setenv(R_PROFILE_USER=file.path(root,'offline.Rprofile'))
  name <- 'ownedchecker'; dir.create(file.path(name,'R'),recursive=TRUE); dir.create(file.path(name,'man'))
  desc <- c('Package: ownedchecker','Version: 1.0.0','Title: Independent Checker Fixture',
    'Description: Independently authored checker fixtures.','License: GPL-2',
    'Author: Fixture Author','Maintainer: Fixture Author <fixture@example.invalid>', 'Depends: R(>= 2.10)')
  writeLines(desc,file.path(name,'DESCRIPTION')); writeLines('export(f)',file.path(name,'NAMESPACE'))
  writeLines('f <- local({ marker <- 3; function(x, y=2) x + y + marker })',file.path(name,'R','f.R'))
  writeLines(c('\\name{f}','\\alias{f}','\\title{F}','\\usage{f(x, y=2)}',
    '\\arguments{\\item{x}{First.}\\item{y}{Second.}}','\\value{Sum.}','\\description{Fixture.}',
    '\\examples{','if (FALSE) library(zzownedrun)',
    '\\dontrun{if (FALSE) library(zzowneddontrun)}',
    '\\donttest{if (FALSE) library(zzowneddonttest)}','}'),file.path(name,'man','f.Rd'))
  exe <- file.path(R.home('bin'), if(.Platform$OS.type=='windows') 'R.exe' else 'R')
  suppressWarnings(system2(exe,c('CMD','check','--no-manual','--no-tests','--no-vignettes','--no-build-vignettes',name),stdout='check.log',stderr='check.log'))
  lines <- readLines('check.log',warn=FALSE)
  item <- function(name) {
    i <- grep(paste0('* checking ',name),lines,fixed=TRUE)[1L]; if(is.na(i)) stop('Check absent: ',name)
    j <- i+1L; while(j<=length(lines) && !startsWith(lines[j],'* ')) j<-j+1L
    lines[i:(j-1L)]
  }
  for(label in c('DESCRIPTION meta-information','for code/documentation mismatches','for unstated dependencies in examples')) {
    section <- item(label)
    cat(label, ':', sub('.* \\.\\.\\. ', '', section[1L]), '\n', sep='')
    if(label=='for unstated dependencies in examples') for(p in c('zzownedrun','zzowneddontrun','zzowneddonttest')) cat(p,'=',any(grepl(p,section,fixed=TRUE)),'\n',sep='')
  }
  for(strict in c(FALSE,TRUE)) cat('dependency strict=',strict,':','bad_depends_or_suggests_or_imports' %in% names(tools:::.check_package_description(file.path(name,'DESCRIPTION'),strict=strict)),'\n',sep='')
})
