FROM node:20

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma/

RUN npm install

RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD sh -c "npx prisma migrate deploy && node index.js"