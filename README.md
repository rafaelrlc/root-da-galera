# Root League

App em `Next.js + Tailwind` para registrar partidas de Root, calcular leaderboard geral e por facção, e acompanhar seasons de 6 semanas.

## Stack

- `Next.js` com App Router
- `Tailwind CSS`
- API routes no próprio Next
- `Neon` ou qualquer Postgres compatível para persistência simples no deploy da Vercel

## Rodando localmente

1. Instale as dependências com `npm install`
2. Configure `DATABASE_URL` no `.env.local`
3. Rode `npm run dev`

O schema é criado automaticamente na primeira execução das rotas.

## Deploy

Na Vercel, conecte um banco `Neon` ou outro Postgres compatível e exponha a variável `DATABASE_URL`. Depois disso, o app já sobe com persistência e sem autenticação.
