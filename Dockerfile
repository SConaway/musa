FROM node:lts-slim

WORKDIR /usr/src/app

COPY . .

RUN ./setup.sh

CMD ["sh", "./start.sh"]
