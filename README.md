# SILLYN — gestionale personale e business

Progetto full-stack costruito sullo stack indicato:

- **React + Vinext + Vite** per interfaccia e routing App Router.
- **TypeScript** per le API server.
- **Cloudflare Workers** per eseguire l'applicazione.
- **D1** per account, sessioni, spazi, registrazioni e metadati.
- **R2** per conservare i documenti caricati.

> Stato: codice sorgente applicativo preparato. Non è ancora pubblicato su un account Cloudflare: la pubblicazione richiede l'autenticazione al tuo account e la creazione dei binding D1/R2. Non inserire mai token Cloudflare o password nel codice o in chat.

## Funzioni incluse

- Registrazione e accesso con password protetta tramite PBKDF2 e sessione HTTP-only.
- Due spazi creati alla registrazione: Personale e Business.
- Creazione di ulteriori spazi.
- Spese, attività, scadenze, fatture/ incassi, collaboratori, contatti e note.
- Caricamento documenti in R2 con metadati in D1, download e cancellazione.
- Inviti tramite codice temporaneo con ruoli owner/admin/member/viewer.
- Dashboard, ricerca nelle sezioni e riepiloghi.

## Avvio e prima configurazione Cloudflare

Richiede **Node.js 22 o superiore** e pnpm. Vinext è attualmente in beta: prima della produzione va verificata la compatibilità con la versione installata.

1. Installa le dipendenze:

   ```bash
   pnpm install
   ```

2. Accedi al tuo account Cloudflare (serve una sola volta sul computer usato per la pubblicazione):

   ```bash
   pnpm exec cf auth login
   ```

3. Crea il database D1 e il bucket R2:

   ```bash
   pnpm exec cf d1 create --name sillyn-db
   pnpm exec cf r2 buckets create --name sillyn-files
   ```

   Il comando D1 restituisce un ID. Inseriscilo in `cloudflare.config.ts` nel binding DB, così:

   ```ts
   DB: bindings.d1({ name: "sillyn-db", id: "INCOLLA_QUI_ID_D1" }),
   ```

   Il bucket R2 è già collegato con il nome `sillyn-files`. I nomi dei binding `DB` e `FILES` devono rimanere invariati.

4. Applica lo schema al database remoto, sostituendo `ID_D1` con l'ID restituito al punto 3:

   ```bash
   pnpm exec cf d1 migrations apply ID_D1 --dir migrations
   ```

5. Genera i tipi Cloudflare e verifica l'app in locale:

   ```bash
   pnpm exec cf workers types
   pnpm dev
   ```

6. Quando registrazione, accesso, creazione dei dati e upload documenti sono stati provati, pubblica:

   ```bash
   pnpm dlx @vinext/cloudflare deploy
   ```

   La procedura stampa l'indirizzo pubblico del Worker. La documentazione ufficiale Vinext descrive questo flusso e l'uso dei binding `cloudflare:workers`.

## Note importanti prima di usarlo con dati reali

- Ogni account ha spazi separati; gli inviti aggiungono membri a uno spazio e assegnano un ruolo.
- Il codice non invia email: genera un codice invito da condividere in modo privato.
- I file caricati sono limitati a 15 MB e a formati documentali comuni.
- L'app non effettua fatturazione elettronica, pagamenti, dichiarazioni fiscali o comunicazioni ufficiali: la sezione fatture è un registro gestionale interno.
- Prima di coinvolgere dipendenti/clienti o archiviare documenti reali, completare test di sicurezza, privacy policy, termini, backup, controllo accessi, gestione recupero password, rate limiting e valutazione GDPR.
- Non è inclusa ancora una chat AI: va aggiunta come servizio server separato dopo aver definito provider, costi e trattamento dei dati.

## Struttura

```text
app/
  api/auth/              registrazione, login, logout, sessione
  api/workspaces/        spazi personali e business
  api/records/           operazioni CRUD per i registri
  api/documents/         upload/download/delete con R2
  api/invitations/       inviti e adesione a uno spazio
  page.tsx               interfaccia React
  styles.css             stile responsive
src/lib/                 accesso D1/R2, auth e funzioni HTTP
migrations/              schema D1
cloudflare.config.ts     binding D1/R2 e Worker Vinext
public/                  manifest PWA
```
