# MENTORA Module Scaffold — Cheat Sheet

## Basic usage
```cmd
npm run scaffold <moduleName>
```
Generates `src/modules/<moduleName>/` with schema, types, repository, service, controller, route, openapi, test, and index files (model must exist in `prisma/schema.prisma`).

## Options

| Flag | Effect |
|---|---|
| `--type=standard` | Full CRUD, extends base classes (default) |
| `--type=tableless` | No Prisma model — plain service + controller |
| `--type=readonly` | Read-only, no create/update/delete |
| `--type=custom` | Repository + service extend base, plain controller |
| `--type=external` | No repository — wraps an external SDK |
| `--no-soft-delete` | Hard delete only |
| `--extra-repos=a,b` | Inject additional repositories into the service |

## Examples
```cmd
npm run scaffold booking
npm run scaffold dashboard --type=tableless
npm run scaffold payments --extra-repos=wallet,escrow
npm run scaffold sessions --type=external
npm run scaffold logs --type=readonly --no-soft-delete
```

## After scaffolding — checklist

1. **Register the route** (in `src/modules/index.ts` or `src/app.ts`):
   ```ts
   import <moduleName>Router from './<moduleName>'
   app.use('/api/v1/<moduleName>s', <moduleName>Router)
   ```

2. **Add OpenAPI import** to `cli/build-docs.ts`:
   ```ts
   import "../src/modules/<moduleName>/<moduleName>.openapi";
   ```

3. **Rebuild docs**:
   ```cmd
   npm run docs:build
   ```

4. **Set searchableFields** in `<moduleName>.repository.ts`

5. **Implement business logic** in `<moduleName>.service.ts` (lifecycle hooks: `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`)

6. **Add translations**:
   - `src/locales/en/<moduleName>.json`
   - `src/locales/fr/<moduleName>.json`
   - (PLEINGAZ rule: include all error/success message keys with empty string values)