FROM node:10-alpine

RUN apk add git

RUN mkdir /usr/bot
WORKDIR /usr/bot

COPY package.json yarn.lock /usr/bot/

RUN yarn

COPY ./src /usr/bot/src/
COPY ./tsconfig.json /usr/bot

RUN yarn build

CMD ["yarn", "start"]
