# First stage: test
FROM node:12-alpine as nodebuild
WORKDIR /app
COPY main/package*.json ./
COPY main/*.js ./
COPY main/test/ ./test/
RUN npm install && \
    npm test

# Second stage: runtime image
FROM node:12-alpine as noderun
RUN apk add --no-cache bash tini
ENTRYPOINT ["/sbin/tini", "--"]
ENV KUBECTL_VERSION=1.16.0
RUN wget https://storage.googleapis.com/kubernetes-release/release/v$KUBECTL_VERSION/bin/linux/amd64/kubectl
RUN chmod a+rx kubectl
WORKDIR /app
COPY main/entrypoint ./
COPY main/package*.json ./
COPY main/*.js ./
RUN npm install --only=prod
USER node
CMD [ "./entrypoint" ]
