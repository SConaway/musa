FROM node:16-alpine

LABEL commit=${GITHUB_SHA:-NA}

WORKDIR /usr/src/app

COPY . .

RUN ./setup.sh

CMD ["sh", "./start.sh"]
