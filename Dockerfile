FROM node:20-slim as builder

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install

COPY . .

RUN ./setup.sh


FROM node:20-slim as runner

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --production

COPY start.sh prisma/ ./

COPY --from=builder /usr/src/app/dist/ dist/

COPY views/ views/

RUN yarn prisma generate

CMD ./start.sh
