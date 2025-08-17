FROM node:22-alpine
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
# Augmente la mémoire à 4GB (4096 Mo) pour l'étape de build
RUN NODE_OPTIONS="--max-old-space-size=4096" yarn build
EXPOSE 4000
CMD ["node", "dist/main.js"]