# Bootcamp Treinos · API

API de um app de treinos com **personal trainer por IA**. A IA conversa com o usuário, coleta os dados físicos e monta um plano de treino semanal salvo no banco. Esta é a parte do servidor; a interface está em [bootcamp-treinos-front](https://github.com/EduardoTorres92/bootcamp-treinos-front).

> Projeto desenvolvido durante um bootcamp de desenvolvimento full stack.

## O que ela faz

- **Autenticação própria**: cadastro e login com e-mail e senha, com sessão por cookie.
- **Personal trainer com IA** (`POST /ai`): agente com *tool calling* (Vercel AI SDK + OpenAI) que lê e atualiza os dados do usuário, consulta os planos e cria um plano de treino completo.
- **Planos de treino**: plano semanal com dias, exercícios, séries, repetições e descanso.
- **Sessões de treino**: iniciar e concluir o treino do dia.
- **Estatísticas**: sequência de dias, consistência e taxa de conclusão.
- **Documentação interativa** em `/docs` (OpenAPI + Scalar), gerada a partir dos schemas Zod.

## Tecnologias

Node.js · TypeScript · Fastify · Zod · Prisma · PostgreSQL (Neon) · Vercel AI SDK · OpenAI · Docker Compose

## Estrutura

```
src/
├── routes/     # auth, ai, home, me, stats, workout-plan
├── usecases/   # regras de negócio (CreateWorkoutPlan, GetStats, StartWorkoutSession…)
├── schemas/    # validação com Zod (também gera a documentação)
└── lib/        # banco e sessão
prisma/         # modelo de dados (User, WorkoutPlan, WorkoutDay, WorkoutExercise, WorkoutSession)
```

## Rodar localmente

```bash
pnpm install
cp .env.example .env     # DATABASE_URL e OPENAI_API_KEY
docker compose up -d     # Postgres local (opcional, se não usar o Neon)
pnpm prisma migrate dev
pnpm dev                 # http://localhost:8081  ·  docs em /docs
```
