local({
  root<-tempfile('owned-usage-severity-');dir.create(root);old<-setwd(root)
  on.exit({setwd(old);unlink(root,recursive=TRUE)})
  pkg<-'ownedusage';dir.create(file.path(pkg,'R'),recursive=TRUE);dir.create(file.path(pkg,'man'))
  writeLines(c('Package: ownedusage','Version: 1.0.0','Title: Owned Fixture','Description: Independent fixture.',
    'License: GPL-2','Author: Fixture','Maintainer: Fixture <f@example.invalid>'),file.path(pkg,'DESCRIPTION'))
  writeLines('export(f)',file.path(pkg,'NAMESPACE'));writeLines('f <- function(x) x',file.path(pkg,'R','owned.R'))
  writeLines('options(repos=character())','offline.Rprofile')
  Sys.setenv(R_PROFILE_USER=file.path(root,'offline.Rprofile'),`_R_CHECK_FORCE_SUGGESTS_`='false',
    `_R_CHECK_CRAN_INCOMING_`='false',`_R_CHECK_CRAN_INCOMING_REMOTE_`='false')
  exe<-file.path(R.home('bin'),if(.Platform$OS.type=='windows')'R.exe'else'R')
  for(kind in c('alias','extra','missing','syntax')) for(internal in c(FALSE,TRUE)) {
    alias<-if(kind=='alias')'different'else'f';usage<-if(kind=='syntax')'f(x'else'f(x)'
    arguments<-if(kind=='missing')''else paste0('\\arguments{\\item{x}{Owned.}',if(kind=='extra')'\\item{extra}{Owned.}'else'','}')
    writeLines(paste0('\\name{f}\\alias{',alias,'}\\title{Owned}\\usage{',usage,'}',arguments,
      '\\description{Owned.}',if(internal)'\\keyword{internal}'else''),file.path(pkg,'man','f.Rd'))
    suppressWarnings(system2(exe,c('CMD','check','--no-manual','--no-tests','--no-examples','--no-vignettes','--no-build-vignettes',pkg),stdout='check.log',stderr='check.log'))
    lines<-readLines('check.log',warn=FALSE);i<-grep('usage sections',lines,fixed=TRUE)[1L]
    if(is.na(i))stop('Usage check absent')
    cat(kind,':',internal,':',sub('.* \\.\\.\\. ','',lines[i]),'\n',sep='')
  }
})
