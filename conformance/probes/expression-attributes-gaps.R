# Independently authored GNU R 4.6.1 black-box observations; no native implementation body.
# Both assertions are TRUE in the frozen 47-row native pool, with no warnings/errors.
# The 45-case profile 0.394 increment excludes these two general attributes<- routes.
# These are open browser-meaningful gaps, not passing conformance or platform exclusions.

# attributes-list-replacement
# Frozen assertion SHA-256: a2942578f819080b4d525bdd2e0ed3276f54eec8fc7f1e36f8f2317bcca98a20
stopifnot(isTRUE(local({e<-new.env(parent=emptyenv());x<-expression(1L,2L);attributes(x)<-list(note="owned",names=c("a","b"),owner=e);identical(names(attributes(x)),c("note","names","owner"))&&identical(names(x),c("a","b"))&&identical(attr(x,"owner"),e)})))

# attributes-remove-copy
# Frozen assertion SHA-256: 8a91845e35b0ac3e61eccd6a9c725a83271ec587a4b8daea96bd3d8fd8388530
stopifnot(isTRUE(local({x<-expression(a=1L);attr(x,"note")<-"keep";y<-x;attributes(y)<-NULL;is.null(attributes(y))&&identical(names(x),"a")&&identical(attr(x,"note"),"keep")&&identical(y[[1L]],1L)})))
