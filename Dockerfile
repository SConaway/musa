FROM node:16-alpine

WORKDIR /usr/src/app

COPY . .

RUN ./setup.sh

CMD ["yarn", "start"]
