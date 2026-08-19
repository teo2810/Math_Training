# Allenamento Matematica

App web a file singolo per l'allenamento di matematica (addizioni, sottrazioni, moltiplicazioni, divisioni, frazioni, orologio), pensata per bambini/ragazzi, con difficoltà adattiva e report via email per il tutor.

## Caratteristiche

- Nessuna dipendenza esterna: un solo file `index.html`, funziona anche offline una volta caricato.
- Difficoltà adattiva: si alza o si abbassa in automatico in base a correttezza e tempo di risposta.
- Categorie di esercizi progressive: aritmetica → frazioni (da difficoltà 3) → orologio (da difficoltà 5) → divisioni (da difficoltà 7).
- Fine sessione automatica dopo 5 minuti o su richiesta ("Per oggi basta").
- Report riepilogativo inviato via `mailto:` al tutor, con dettaglio della sessione e statistiche ultimi 7/30 giorni.
- Impostazioni (accesso con pressione prolungata sul pulsante "Impostazioni"): nome del ragazzo, nome ed email del tutor, reset di livello/report/tutto.
- Dati salvati solo in locale nel browser (`localStorage`): nessun server, nessun tracciamento. Il file distribuito non contiene nomi né email preimpostate: la prima configurazione (nome, tutor, email) va fatta dalle Impostazioni.

## Pubblicazione su GitHub Pages

1. Crea un repository (es. `allenamento-matematica`) e carica `index.html` nella root.
2. Nel repository: **Settings → Pages → Source**, seleziona il branch `main` e cartella `/ (root)`.
3. Dopo qualche minuto l'app sarà disponibile su `https://<utente>.github.io/<repo>/`.

Per un accesso riservato (solo tu/famiglia), è possibile mettere il dominio dietro Cloudflare Access o simili.

## Uso in locale

Basta aprire `index.html` in un browser mobile o desktop: nessuna build, nessun server necessario.

## Note tecniche

- Tutto lo stato (nome, email tutor, livello, storico esercizi) è salvato in `localStorage` del browser: cambiando browser o dispositivo i dati non si sincronizzano.
- L'invio del report usa il link `mailto:`, quindi apre l'app di posta predefinita del dispositivo: l'utente deve comunque premere "Invia" per completare l'invio.
- Ottimizzata per schermi mobili in verticale; il layout si adatta anche alla comparsa della tastiera virtuale.

## Licenza

Uso personale/familiare. Nessuna licenza open source dichiarata: adattare liberamente per uso privato.
