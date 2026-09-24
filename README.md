# Allenamento Matematica

App web a file singolo. Funziona offline.

## Branch

- `main` = **V1 stabile**. Non va toccata da questa linea di lavoro.
- `v2-adaptive` = **V2 adattiva** (in sviluppo). Usare solo questo branch per il motore nuovo.

I dati V1 e V2 stanno su chiavi `localStorage` diverse. Reset V2 non cancella V1.

## V1 (main)

- Livello 1–10 dal tutor, tetto, blocco livello.
- Dopo un errore: riformulazione/aiuto, senza risultato immediato.
- Fine sessione su «Per oggi basta» o checkpoint.
- Report via `mailto:`.

## V2 (`v2-adaptive`, fasi A–D)

Motore per micro-competenze, non più guidato dal solo livello globale.

Implementato ora:

- catalogo competenze estendibile
- profilo + storico V2 (`math_training_v2_*`)
- selection engine a priorità (recupero / consolidamento / mantenimento / nuovo)
- generazione addizioni e sottrazioni
- mastery 0–100, aiuti a gradi, tempi di risposta
- campi spaced repetition
- area tutor (forzature, reset competenza/profilo, JSON, export/import, test motore)
- report per genitore/tutor in linguaggio ordinario

Non ancora: moltiplicazioni, divisioni, orologio, denaro, vita quotidiana (fasi I–M).

## Uso

Aprire `index.html`. Impostazioni: pressione prolungata su «Impostazioni».
Area tutor: in fondo alle Impostazioni.

## Licenza

Uso personale/familiare.
