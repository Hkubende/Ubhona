# Build Commands

## Frontend / Full Repo

```powershell
npm run dev
npm run build
npm run check:all
npm run validate:data
npm run validate:dishes
npm run validate:assets
```

## Backend

```powershell
npm run backend:start
npm run backend:dev
npm run backend:test
npm --prefix backend run build
npm --prefix backend run test
```

## Prisma

```powershell
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:migrate:deploy
```

## Payment / Project Helpers

```powershell
npm run check:mpesa
npm run stk:mv4
```

## Most Important Validation Loop

```powershell
npm --prefix backend run test
npm --prefix backend run build
npm run check:all
```
