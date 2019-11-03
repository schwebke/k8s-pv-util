FROM node:12-alpine
RUN apk add --no-cache bash tini
ENV KUBECTL_VERSION=1.16.0
RUN wget https://storage.googleapis.com/kubernetes-release/release/v$KUBECTL_VERSION/bin/linux/amd64/kubectl
RUN chmod a+rx kubectl
ENTRYPOINT ["/sbin/tini", "--"]
WORKDIR /app
COPY main/entrypoint ./
COPY main/package*.json ./
COPY main/*.js ./
RUN npm install
USER node
CMD [ "./entrypoint" ]
