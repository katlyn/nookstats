FROM node:13-alpine

RUN apk add git

RUN mkdir /usr/bot
WORKDIR /usr/bot

COPY package.json package-lock.json /usr/bot/

RUN npm i

COPY ./src /usr/bot/src/
COPY ./tsconfig.json /usr/bot

RUN yarn build

CMD ["yarn", "start"]
