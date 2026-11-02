# Registro Corrispettivi

App per il Registro dei Corrispettivi giornalieri: inserimento per giorno (4%, 10%, 22%, POS, Bonifico, Assegni, esenti, fatture, altri importi), totali mensili e annuali, calcolo IVA per scorporo, stampa e PDF su un foglio A4, import/export Excel, backup e ripristino.

L'app parte vuota: i dati della ditta si inseriscono da **Impostazioni**, gli incassi restano solo sul computer (backup con **Backup**/**Ripristina**).

## Installazione

Scaricare `Registro-Corrispettivi-Setup-x.y.z.exe` dalla pagina [Releases](../../releases/latest) e avviarlo.

## Aggiornamenti

All'avvio l'app controlla se c'è una versione nuova e mostra un avviso con **Aggiorna** e **Chiudi**. Con *Chiudi* l'avviso ricompare alla prossima apertura; si può controllare anche da menu **? › Verifica aggiornamenti** (Alt per mostrare il menu).

## Pubblicare una nuova versione

1. Aumentare `version` in `desktop/package.json` (es. `1.1.0` → `1.2.0`).
2. Fare commit e caricare un tag con lo stesso numero:
   ```
   git tag v1.2.0
   git push origin main --tags
   ```
3. GitHub Actions crea l'installer e la Release; le app installate si aggiornano.

## Sviluppo

- `Registro Corrispettivi.html` — l'app (funziona anche aperta nel browser), librerie in `lib/`
- `desktop/` — app desktop Electron (`npm start` per provarla, `npm run dist` per creare l'installer in `desktop/Installer`)
