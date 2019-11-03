FROM alpine:3
ENV IMAGE_DATE=2019-11-03
RUN apk add --no-cache tar bash xz gzip bzip2 py-pip tini && pip install s3cmd
ENTRYPOINT ["/sbin/tini", "--"]
COPY restorer/entrypoint /
CMD ["/bin/bash", "/entrypoint"]
