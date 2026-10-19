local({
  root<-tempfile('owned-static-codoc-');dir.create(file.path(root,'R'),recursive=TRUE);dir.create(file.path(root,'man'))
  on.exit(unlink(root,recursive=TRUE))
  writeLines(c('Package: ownedstatic','Version: 1.0.0','Title: Owned Fixture','Description: Independent fixture.',
    'License: GPL-2','Author: Fixture','Maintainer: Fixture <f@example.invalid>','Encoding: UTF-8'),file.path(root,'DESCRIPTION'))
  writeLines('',file.path(root,'NAMESPACE'))
  cases<-list(numeric=c('2','2L'),nonfinite=c('NaN','Inf'),ascii=c('"\\x61"','"a"'),
    utf8=c('"\\xc3\\xa9"','"\\u00e9"'),invalid=c('"\\xff"','"\\uFFFD"'),unicode=c('"\\u00e9"','"é"'),
    invalid2=c('"\\xff"','"\\xfe"'),negativezero=c('-0','0'),complex=c('2i','2.0i'),
    rightAssign=c('quote(a <- 1)','quote(1 -> a)'), infix=c('1+2','`+`(1,2)'),
    stringcallee=c('sum(1)','"sum"(1)'), subset=c('a[1]','`[`(a,1)'),
    braces=c('{a;b}','`{`(a,b)'), parens=c('(a)','`(`(a)'),
    closure=c('function(y=2)y','function(y=2L)y'))
  source<-character()
  for(n in names(cases)){
    source<-c(source,paste0(n,' <- function(x=',cases[[n]][1L],') NULL'))
    writeLines(paste0('\\name{',n,'}\\alias{',n,'}\\title{Owned}\\usage{',n,'(x=',cases[[n]][2L],')}\\description{Owned.}'),file.path(root,'man',paste0(n,'.Rd')),useBytes=TRUE)
  }
  writeLines(source,file.path(root,'R','owned.R'),useBytes=TRUE)
  result<-tools::codoc(dir=root)
  for(n in names(cases))cat(n,':',paste0(n,'.Rd') %in% names(result),'\n',sep='')
})
