FROM node:22-alpine

WORKDIR /app

COPY angular-mibodeguita/package*.json ./

RUN npm install --legacy-peer-deps

COPY angular-mibodeguita/ .

EXPOSE 4200

CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200"]
