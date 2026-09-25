# Math Training V2

**Math Training V2** è un'app per esercitarsi con la matematica attraverso sessioni brevi e un percorso che si adatta alle risposte dell'utente. Funziona nel browser, anche su smartphone, senza account né servizi esterni.

## Come funziona

Si inizia con esercizi semplici. Nelle prime 30 risposte l'app costruisce un quadro iniziale del livello; in seguito continua ad aggiornare automaticamente la scelta delle competenze e delle difficoltà dopo ogni risposta. Tiene conto delle risposte autonome, degli errori, degli aiuti utilizzati e delle competenze da ripassare. La difficoltà massima e gli argomenti possono essere regolati nelle impostazioni.

Sono disponibili **52 competenze** in sette aree: addizioni, sottrazioni, moltiplicazioni, divisioni, orologio, denaro e situazioni quotidiane. Le risposte si inseriscono con il tastierino dell'app o con la tastiera. Gli aiuti sono brevi e guidano il ragionamento senza dare la soluzione; dopo una domanda non risolta, la correzione rimane visibile finché non si preme **Avanti**. Il promemoria pausa lascia scegliere se continuare o fermarsi.

## Area Tutor

L'area Tutor mostra il percorso automatico, autonomia, andamento recente, competenze da rinforzare e una mappa radar. La scala del radar si adatta ai progressi osservati; le percentuali indicate in legenda restano quelle effettive. La guida integrata spiega le opzioni tecniche e mostra la modalità attiva.

A fine sessione è possibile scaricare un report. Se è configurato l'indirizzo del tutor, l'app può aprire una bozza email: **non invia messaggi automaticamente**. Si possono esportare e importare backup del profilo V2.

## Dati e passaggio dalla V1

I dati restano nel browser e nel dispositivo in uso. Sullo stesso indirizzo e nello stesso browser, il primo avvio della V2 riprende nome e recapito del tutor dalla V1, conserva lo storico V1 separatamente e avvia da zero il nuovo percorso automatico. Alle visite successive il percorso V2 continua da dove era arrivato. Browser e dispositivi diversi non condividono automaticamente i dati: per trasferire il profilo V2 si usa il backup.

La mappa delle competenze e l'andamento descrivono le risposte raccolte dall'app: non sono una diagnosi né una valutazione clinica.

## Disponibilità

App web statica, in italiano, senza dipendenze esterne a runtime. Il codice dell'interfaccia e del motore si trova in `index.html` e `assets/`. Per caricare la pagina serve una connessione; questa versione non installa un servizio per l'uso offline.
