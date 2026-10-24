# Aurora Glass — plancia animata per Home Assistant, con installazione guidata

🇬🇧 [Read in English](README.md)

![Aurora Glass](https://raw.githubusercontent.com/lucalux00/aurora-glass/main/docs/dashboard-casa-notte-intera.webp)

Una plancia viva: cielo, sole, luna e le finestre della casetta seguono l'ora vera, dieci mondi animati, undici effetti meteo, pulsanti fatti di immagini e GIF, allarme, clima, telecamere e una vista energia con i costi calcolati dalla tua tariffa.

La installi da HACS, riavvii e una **procedura guidata** crea la plancia al posto tuo: trova le stanze dalle aree di Home Assistant, ti fa scegliere i nomi e aggiunge la plancia alla **barra laterale**. Niente YAML. In italiano e in inglese.

- **Demo dal vivo (senza installare):** [provala nel browser](https://domotikpro.it/aurora-glass-v3-demo/index.html?utm_source=github&utm_medium=readme&utm_campaign=aurora-glass&utm_content=demo)
- **Guida completa:** [domotikpro.it/progetti/aurora-glass-v3](https://domotikpro.it/progetti/aurora-glass-v3?utm_source=github&utm_medium=readme&utm_campaign=aurora-glass&utm_content=guide)

## Installazione
1. **HACS** → ⋮ → *Archivi digitali personalizzati* → aggiungi `https://github.com/lucalux00/aurora-glass`, tipo **Integrazione** → cerca **Aurora Glass** → *Scarica*.
2. **Riavvia** Home Assistant.
3. Home Assistant trova Aurora Glass da solo: in **Impostazioni → Dispositivi e servizi** compare tra le integrazioni rilevate → **Aggiungi**. (Oppure *Aggiungi integrazione* → *Aurora Glass*.)
4. Segui la procedura:
   - **La tua plancia** — nome nella barra laterale, icona, lingua (automatica, italiano, inglese).
   - **Stanze** — le aree con delle luci sono già selezionate. Per ogni stanza scrivi il nome che vuoi e controlla luci, sensori di movimento, porte/finestre/serrature e temperatura (già compilati). Puoi aggiungere anche stanze senza area.
   - **Luci senza stanza** — le luci e i relè (Shelly, Sonoff…) che non sono in nessuna area sono in un'unica schermata, già messi nella stanza giusta in base al nome («Lampadario cucina» → Cucina). Controlli, sistemi, fatto: anche con 10 stanze. Se vuoi, finiscono anche nelle aree di Home Assistant.
   - **La tua casa** — centrale allarme, meteo, climatizzatore, potenza (W) ed energia (kWh) della casa, telecamere, valuta. Se lasci vuoto un campo, quella parte non compare.
   - **Scene rapide** — cosa accendono *Buongiorno*, *Cinema* e *Cena* (luci, oppure una scena o uno script).
5. A sinistra compare la nuova voce. Fatto.

Per cambiare qualcosa dopo: **Impostazioni → Dispositivi e servizi → Aurora Glass → Configura**. Ti serve una seconda plancia (per esempio per il tablet a muro)? *Aggiungi servizio*.

Senza HACS: copia `custom_components/aurora_glass` nella cartella di configurazione e riavvia. Il [pacchetto da scaricare](https://domotikpro.it/progetti/aurora-glass-v3?utm_source=github&utm_medium=readme&utm_campaign=aurora-glass&utm_content=package) contiene anche la cartella `italiano/` con la guida passo passo e gli esempi YAML per l'installazione a mano (e la cartella `english/`).

## Cosa fa
- 10 mondi animati e 11 effetti meteo (pioggia, neve, temporale, lucciole, petali, fuochi d'artificio…)
- Cielo e colori seguono l'ora del giorno
- Le tue stanze con i tuoi nomi: quante stanze e luci hai
- 50 immagini e GIF pronte per i pulsanti, modificabili dalla plancia
- Allarme con codice, clima, telecamere con diretta
- Barra in alto da toccare: le luci accese (tocchi una luce e si spegne) e le stanze con movimento, con l'ultima volta che ogni sensore ha visto qualcuno
- Vista Energia: potenza in tempo reale, kWh di oggi / ieri / mese / anno (calcolati dallo storico del contatore, senza sensori in più) e costi = kWh × la tua tariffa
- Italiano e inglese; in automatico segue la lingua di ogni utente
- **Privacy:** tutto in locale. L'unica richiesta esterna sono i font Google (Manrope, Sora).

## Pacchetti facoltativi
Funzioni in più da aggiungere e togliere quando vuoi: **Impostazioni → Dispositivi e servizi → Aurora Glass → Configura → Pacchetti**. Spunta per scaricare e attivare, togli la spunta per rimuovere, poi ricarica la pagina del browser. Non viene scaricato niente finché non spunti qualcosa, e Aurora Glass funziona uguale anche senza pacchetti.

- **Regia**: pad delle scene animati, dissolvenza A ⇄ B tra due scene, REC per salvare le luci come nuovo pad, luminosità e colore per stanza. [Provala dal vivo](https://domotikpro.it/aurora-glass-pacchetti-demo/index.html?vista=regia&utm_source=github&utm_medium=readme&utm_campaign=aurora-glass-pacchetti)

Elenco e file dei pacchetti arrivano da [domotikpro.it](https://domotikpro.it/progetti/aurora-glass-pacchetti?utm_source=github&utm_medium=readme&utm_campaign=aurora-glass-pacchetti); ogni file viene controllato con lo SHA-256 dell'elenco prima di installarlo. Nessun dato della tua casa viene inviato.

## La scheda nelle tue plance
L'integrazione carica la scheda ovunque, quindi puoi usarla in qualsiasi plancia (meglio in una vista a pannello):

```yaml
type: custom:aurora-glass-card
language: it
rooms:
  - name: Soggiorno
    lights: [light.soggiorno, light.lampada_divano]
    motion: binary_sensor.soggiorno_movimento
    openings: [binary_sensor.porta_ingresso]
    temperature: sensor.soggiorno_temperatura
  - name: Cucina
    lights: [light.cucina]
entities:
  alarm: alarm_control_panel.allarme
  weather: weather.forecast_home
  energy:
    power: sensor.potenza_casa
    energyTotal: sensor.energia_totale
```

Tutte le opzioni sono in [`package/italiano/scheda-esempio.yaml`](package/italiano/scheda-esempio.yaml).

## Se qualcosa non va
- *La voce non compare dopo la procedura* — ricarica la pagina (Ctrl+F5).
- *Luci grigie* — il dispositivo è offline o l'entità è stata tolta: *Configura → Stanze*.
- *Costi a zero* — nella vista Energia tocca la barra *Tariffa* e scrivi quanto paghi un kWh.

## Rimuovere
Impostazioni → Dispositivi e servizi → Aurora Glass → Elimina, poi rimuovila da HACS.

## Licenza
[GPL-3.0](LICENSE). Puoi usarla, studiarla, modificarla e condividerla, anche a scopo commerciale, purché ogni versione modificata che distribuisci resti GPL-3.0, abbia il codice sorgente e mantenga la nota originale: © 2026 DomotikPro.it (Luca Pinelli).

Il nome "Aurora Glass" e il marchio DomotikPro.it non sono coperti dalla licenza: una versione modificata deve usare un nome diverso.

---
Fatta da [DomotikPro.it](https://domotikpro.it/?utm_source=github&utm_medium=readme&utm_campaign=aurora-glass&utm_content=footer) — guide pratiche per una casa smart che funziona.
