# Independently authored Rd cases. Only bounded outcomes leave the native checker.
local({
  work <- tempfile('owned-rd-contexts-'); dir.create(work); old <- setwd(work)
  on.exit({setwd(old); unlink(work, recursive=TRUE)})
  name <- 'ownedrd'; dir.create(file.path(name,'man'),recursive=TRUE); dir.create(file.path(name,'R'))
  writeLines(c('Package: ownedrd','Version: 1.0','Title: Owned Fixture','Description: Independent fixture.',
    'License: GPL-2','Author: Fixture','Maintainer: Fixture <fixture@example.invalid>'),file.path(name,'DESCRIPTION'))
  writeLines('export(f,g,h,k,m)',file.path(name,'NAMESPACE'))
  writeLines(c('f <- function(x,y=2) x','g <- function(x,y=2) x','h <- function(x,y=2) x',
    'k <- function(x,y=2) x','m <- function(x,y=3) x'),file.path(name,'R','owned.R'))
  cases <- c(
    ordinary='\\name{ordinary}\\alias{f}\\title{Owned}\\usage{f(x,y=2)}\\description{Owned.}',
    internal='\\name{internal}\\alias{g}\\title{Owned}\\usage{g(x,y=2)}\\description{Owned.}\\keyword{internal}',
    internalExtra='\\name{internalExtra}\\alias{h}\\title{Owned}\\usage{h(x,y=2)}\\arguments{\\item{x}{Owned.}\\item{extra}{Owned.}}\\description{Owned.}\\keyword{internal}',
    internalAlias='\\name{internalAlias}\\alias{different}\\title{Owned}\\usage{k(x,y=2)}\\description{Owned.}\\keyword{internal}',
    internalMismatch='\\name{internalMismatch}\\alias{m}\\title{Owned}\\usage{m(x,y=2)}\\description{Owned.}\\keyword{internal}',
    internalSyntax='\\name{internalSyntax}\\alias{f}\\title{Owned}\\usage{f(x}\\description{Owned.}\\keyword{internal}'
  )
  for(n in names(cases)) writeLines(cases[[n]],file.path(name,'man',paste0(n,'.Rd')))
  links <- c(alias='\\link[base:mean]{owned}',topic='\\link[grDevices:cairo]{owned}',
    plainTopic='\\link[grDevices]{cairo}',fallback='\\link[base:median]{owned}',
    unqualified='\\link{cairo}',spaces='\\link{ mean }',missing='\\link[base:zzownedmissing]{owned}',
    ownName='\\link[ownedrd:ownname]{owned}',ownFilename='\\link[ownedrd:ownfilename]{owned}',
    ownAlias='\\link[ownedrd:ownalias]{owned}',ownFallback='\\link[ownedrd:median]{owned}')
  writeLines('\\name{ownname}\\alias{ownalias}\\title{Owned}\\description{Owned.}',file.path(name,'man','ownfilename.Rd'))
  for(n in names(links)) writeLines(paste0('\\name{link',n,'}\\alias{link',n,'}\\title{Owned}\\description{',links[[n]],'}'),file.path(name,'man',paste0('link',n,'.Rd')))
  writeLines('options(repos=character())','offline.Rprofile')
  Sys.setenv(R_PROFILE_USER=file.path(work,'offline.Rprofile'),`_R_CHECK_FORCE_SUGGESTS_`='false',
    `_R_CHECK_CRAN_INCOMING_`='false',`_R_CHECK_CRAN_INCOMING_REMOTE_`='false')
  exe <- file.path(R.home('bin'),if(.Platform$OS.type=='windows')'R.exe'else'R')
  suppressWarnings(system2(exe,c('CMD','check','--no-manual','--no-tests','--no-examples','--no-vignettes','--no-build-vignettes',name),stdout='check.log',stderr='check.log'))
  lines <- readLines('check.log',warn=FALSE)
  section <- function(label) {
    i <- grep(label,lines,fixed=TRUE)[1L]; if(is.na(i)) stop('Check absent: ',label)
    j <- i+1L; while(j<=length(lines) && !startsWith(lines[j],'* ')) j<-j+1L
    lines[i:(j-1L)]
  }
  usage <- section('usage sections')
  for(n in names(cases)) cat('usage:',n,':',any(grepl(paste0("'",n,".Rd'"),usage,fixed=TRUE)),'\n',sep='')
  codoc <- section('for code/documentation mismatches')
  cat('codoc:internalMismatch:',any(grepl('internalMismatch.Rd',codoc,fixed=TRUE)),'\n',sep='')
  cross <- section('Rd cross-references')
  for(n in names(links)) cat('link:',n,':',any(grepl(paste0("'link",n,".Rd'"),cross,fixed=TRUE)),'\n',sep='')

  contexts <- c(
    preformatted='\\preformatted{cat("owned\\n")}',
    out='\\if{latex}{\\out{\\begin{center}owned\\end{center}}}',
    unknown='\\notARdMacro{owned}',
    outsideMath='\\alpha',
    equation='\\eqn{\\ownedmath{a%literal}}{a}',
    verbatim='\\preformatted{a{b}\\{c\\}\\%d%comment\n\\n}',
    url='\\href{https://example.invalid/\\owned}{\\emph{owned}}'
  )
  for(n in names(contexts)) {
    warnings <- 0L
    status <- tryCatch(withCallingHandlers({
      input <- textConnection(paste0('\\name{owned}\\alias{owned}\\title{Owned}\\description{',contexts[[n]],'}'))
      parsed <- tools::parse_Rd(input); close(input)
      tools::Rd2txt(parsed,out='rendered.txt'); 'completed'
    },warning=function(w){warnings<<-warnings+1L;invokeRestart('muffleWarning')}),error=function(e)'failed')
    cat('context:',n,':',status,':',warnings,'\n',sep='')
    if(n=='verbatim') {
      texts <- character()
      walk <- function(x,inside=FALSE) {
        if(is.list(x)) {
          inside <- inside || identical(attr(x,'Rd_tag'),'\\preformatted')
          for(y in x)walk(y,inside)
        } else if(inside && identical(attr(x,'Rd_tag'),'VERB')) texts<<-c(texts,x)
      }
      walk(parsed)
      cat('verbatim-bytes:',paste(as.integer(charToRaw(paste(texts,collapse=''))),collapse=','),'\n',sep='')
    }
  }
})
