FROM node:16-alpine

WORKDIR /usr/src/app

COPY .git/ .git/

COPY . .

RUN ./setup.sh

CMD ["sh", "./start.sh"]
