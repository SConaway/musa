FROM node:18-alpine

WORKDIR /usr/src/app

COPY . .

RUN ./setup.sh

CMD ["sh", "./start.sh"]
