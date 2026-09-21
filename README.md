# Allenamento Matematica

App web a file singolo per l'allenamento di matematica (addizioni, sottrazioni, moltiplicazioni, divisioni, frazioni, orologio, percentuali), pensata per bambini/ragazzi, con difficoltà 0–10 impostabile dal tutor e report via email.

## Caratteristiche

- Nessuna dipendenza esterna: un solo file `index.html`, funziona anche offline una volta caricato.
- Livello 0–10 settabile dal tutor con una barra in Impostazioni.
- Opzione «Blocca livello»: il tutor fissa la difficoltà; senza blocco l'app si adatta ancora da sola.
- Categorie progressive: addizioni semplici → sottrazioni → tabelline → frazioni → orologio → divisioni → mix adulto (2–3 cifre, percentuali, tre termini).
- Fine sessione automatica dopo 2 minuti di checkpoint o su richiesta («Per oggi basta»).
- Report riepilogativo inviato via `mailto:` al tutor.
- Impostazioni (pressione prolungata su «Impostazioni»): nome, tutor, email, livello, blocco, reset.
- Dati solo in `localStorage` del browser. Nessun server, nessuna sincronizzazione tra dispositivi.

## Remoto

Non è possibile cambiare il livello a distanza. La PWA (o la pagina aperta) legge e scrive solo il `localStorage` di quel telefono. Per un controllo remoto servirebbe un backend (account tutor + sync).

## Licenza

Uso personale/familiare.
