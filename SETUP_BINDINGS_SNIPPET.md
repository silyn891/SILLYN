Il file `cloudflare.config.ts` è già predisposto con i binding. Dopo aver creato D1, inserisci il suo ID nel campo `id`:

```ts
DB: bindings.d1({ name: "sillyn-db", id: "INCOLLA_QUI_ID_D1" }),
FILES: bindings.r2({ name: "sillyn-files" }),
```

Non condividere pubblicamente l'ID insieme a token Cloudflare. Le credenziali di accesso Cloudflare non devono essere scritte nel repository.
