/* ============================================================================
   AURORA GLASS v3 — lingue
   Il codice è scritto in italiano: T("frase") restituisce la frase nella lingua
   scelta. {n}, {p}, ... vengono sostituiti con i valori passati: T("{n} luci", { n: 3 }).
   Per aggiungere una lingua basta un altro dizionario come EN.
   ========================================================================== */
(function (g) {
  var EN = {
    /* stanze e luci di esempio */
    "Salotto": "Living room", "Ingresso": "Entrance", "Corridoio": "Hallway", "Cucina": "Kitchen", "Balcone": "Balcony", "Camera": "Bedroom", "Cameretta": "Kids' room",
    "Bagno piccolo": "Small bathroom", "Bagno doccia": "Shower room", "Lavanderia": "Laundry", "Sgabuzzino": "Storage room",
    "Zona giorno": "Living area", "Zona notte": "Sleeping area", "Bagni": "Bathrooms", "Servizi": "Utility", "Stanza": "Room",
    "Porta ingresso": "Front door", "Balcone salotto": "Living room balcony", "Balcone cucina": "Kitchen balcony", "Finestra cameretta": "Kids' room window",
    "Balcone camera": "Bedroom balcony", "Finestra bagno": "Bathroom window", "Finestra lavanderia": "Laundry window", "Serratura": "Lock",
    "Aperta": "Open", "Chiusa": "Closed", "Aperto": "Open", "Chiuso": "Closed", "Sbloccata": "Unlocked", "Bloccata": "Locked",
    /* libreria immagini */
    "Luci": "Lights", "Scene": "Scenes", "Sensori": "Sensors", "Allarme": "Alarm", "Clima": "Climate",
    "Bagno 1": "Bathroom 1", "Doccia": "Shower", "Notte": "Night", "Esco": "Leaving", "Movimento": "Motion", "Porta": "Door", "Finestra": "Window",
    "Cancello": "Gate", "Off": "Off", "Fuori": "Away", "Scattato": "Triggered",
    /* scene */
    "Buongiorno": "Good morning", "Cucina, corridoio, bagno": "Kitchen, hallway, bathroom", "Buongiorno! Cucina, corridoio e bagno accesi.": "Good morning! Kitchen, hallway and bathroom are on.",
    "Cinema": "Cinema", "Solo il salotto": "Living room only", "Scena Cinema: solo il salotto resta acceso.": "Cinema scene: only the living room stays on.",
    "Cena": "Dinner", "Cucina e salotto": "Kitchen and living room", "Scena Cena: cucina e salotto accesi.": "Dinner scene: kitchen and living room are on.",
    "Buonanotte": "Good night", "Spegne tutto · allarme notte": "All off · night alarm", "Buonanotte! Luci spente, allarme in modalità notte.": "Good night! Lights off, alarm in night mode.",
    "Esco di casa": "Leaving home", "Spegne tutto · allarme fuori": "All off · away alarm", "Casa chiusa: luci spente, allarme inserito.": "House locked up: lights off, alarm armed.",
    "Spegne tutte le luci": "Turns all lights off", "Luci spente.": "Lights off.", "Scena {n}: luci impostate.": "{n} scene: lights set.", "Scena {n} avviata.": "{n} scene started.",
    "Scena {n}": "{n} scene", "Scena {n}: invio i comandi…": "{n} scene: sending commands…",
    "{n} luce non ha risposto": "{n} light did not respond", "{n} luci non hanno risposto": "{n} lights did not respond", "luci come previsto": "lights as expected",
    "{n} non raggiungibile": "{n} unreachable", "{n} non raggiungibili": "{n} unreachable",
    /* allarme */
    "Disattivato": "Disarmed", "Casa libera. Scegli una modalità per armare l'allarme.": "Nobody is watching. Pick a mode to arm the alarm.",
    "Allarme off": "Alarm off", "Armato · Notte": "Armed · Night", "Porte e finestre sorvegliate. Il movimento interno viene ignorato.": "Doors and windows are watched. Indoor motion is ignored.",
    "Allarme notte": "Night alarm", "Armato · Fuori casa": "Armed · Away", "Tutta la casa è sorvegliata, compreso il movimento interno.": "The whole house is watched, indoor motion included.",
    "Allarme fuori casa": "Away alarm", "Si sta armando…": "Arming…", "L'allarme si inserirà tra pochi secondi.": "The alarm will arm in a few seconds.",
    "Allarme in inserimento": "Alarm arming", "ALLARME ATTIVO": "ALARM TRIGGERED", "L'allarme è scattato. Controlla le telecamere.": "The alarm went off. Check the cameras.",
    "allarme: serve il codice": "alarm: code needed", "allarme non trovato": "alarm not found", "Centrale allarme non trovata": "Alarm panel not found",
    "Allarme: la centrale non ha eseguito il comando (codice errato o non disponibile)": "Alarm: the panel did not carry out the command (wrong code or unavailable)",
    "Serve il codice per: {m}": "Code needed for: {m}", "Invio: {m}…": "Sending: {m}…", "Allarme attivo!": "Alarm triggered!",
    /* luci e sensori */
    "Non riuscito: {e}": "Failed: {e}", "errore di Home Assistant": "Home Assistant error",
    "Movimento {n}": "Motion {n}", "Luce {n}": "Light {n}", "Spenta": "Off", "Accesa": "On",
    "{n}: dispositivo non disponibile": "{n}: device unavailable", "{n}: non risponde, non so se il comando è arrivato": "{n}: not responding, the command may not have arrived",
    "{n}: il comando non ha avuto effetto": "{n}: the command had no effect",
    "Nessun movimento": "No motion", "Non disponibile": "Unavailable", "Movimento!": "Motion!", "Movimento: {n}": "Motion: {n}", "Casa tranquilla": "All quiet at home",
    "{n} luce accesa": "{n} light on", "{n} luci accese": "{n} lights on", "Nessuna luce accesa": "No lights on", "Tutte le luci spente": "All lights off",
    "{n} non risponde": "{n} not responding", "{n} non rispondono": "{n} not responding",
    "{n} sensore offline": "{n} sensor offline", "{n} sensori offline": "{n} sensors offline", "Nessuna aperta": "None open", "Tutto chiuso": "All closed",
    "{n} apertura attiva": "{n} opening open", "{n} aperture attive": "{n} openings open",
    "adesso": "just now", "{n} s fa": "{n} s ago", "{n} min fa": "{n} min ago", "{n} h fa": "{n} h ago", "Ultimo movimento: {n}": "Last motion: {n}",
    "Nessuna luce trovata: controlla le entità nella configurazione": "No lights found: check the entities in the configuration",
    "Spengo {n} luci…": "Turning off {n} lights…", "{n} luce è ancora accesa": "{n} light is still on", "{n} luci sono ancora accese": "{n} lights are still on",
    "{n} luce non risponde: non so se sia spenta": "{n} light is not responding: it may still be on", "{n} luci non rispondono: non so se siano spente": "{n} lights are not responding: they may still be on",
    "n.d.": "n/a", "Sensore di temperatura non disponibile": "Temperature sensor unavailable", "Sensori di movimento offline": "Motion sensors offline",
    "Nessun sensore di movimento risponde": "No motion sensor is responding", "Nessun movimento recente": "No recent motion",
    /* mondo, ora, effetti */
    "Mondo: {n}": "World: {n}", "Buon pomeriggio": "Good afternoon", "Buonasera": "Good evening", "Ora reale ripristinata": "Real time restored",
    "Nessuno": "None", "Il mondo cambierà ogni 30 secondi": "The world will change every 30 seconds",
    "Casetta": "Little house", "Sole, luna, nuvole e la tua casetta con le finestre che si accendono": "Sun, moon, clouds and your little house with windows that light up",
    "Città": "City", "Grattacieli con finestre che si accendono, auto, aereo e insegne al neon": "Skyscrapers with windows that light up, cars, a plane and neon signs",
    "Montagna": "Mountains", "Cime innevate, funivia, baita, aurora boreale e neve che cade": "Snowy peaks, cable car, chalet, northern lights and falling snow",
    "Mare e faro": "Sea and lighthouse", "Onde che scorrono, barca a vela, gabbiani, delfino e un faro che gira": "Rolling waves, a sailing boat, seagulls, a dolphin and a turning lighthouse",
    "Foresta magica": "Magic forest", "Raggi di sole di giorno, lucciole, funghi luminosi e un gufo di notte": "Sunbeams by day, fireflies, glowing mushrooms and an owl at night",
    "Spazio": "Space", "Nebulose, pianeta con anelli, astronauta che fluttua, stelle cadenti, satellite e UFO": "Nebulae, a ringed planet, a floating astronaut, shooting stars, a satellite and a UFO",
    "Giappone": "Japan", "Monte Fuji, torii, pagoda, ciliegio con petali che cadono e lanterne": "Mount Fuji, torii, a pagoda, a cherry tree with falling petals and lanterns",
    "Cyberpunk": "Cyberpunk", "Metropoli al neon sotto la pioggia: insegne che sfarfallano, auto volanti, ologramma": "Neon city in the rain: flickering signs, flying cars, a hologram",
    "Natale": "Christmas", "Casa innevata con luci colorate, albero, pupazzo di neve e la slitta di Babbo Natale": "Snowy house with coloured lights, a tree, a snowman and Santa's sleigh",
    "Oceano": "Ocean", "Sott'acqua: banchi di pesci, meduse luminose, balena, sottomarino, alghe e bolle": "Underwater: schools of fish, glowing jellyfish, a whale, a submarine, seaweed and bubbles",
    "Pioggia": "Rain", "Temporale": "Thunderstorm", "Neve": "Snow", "Nebbia": "Fog", "Foglie d'autunno": "Autumn leaves", "Petali": "Petals", "Lucciole": "Fireflies",
    "Stelle cadenti": "Shooting stars", "Fuochi d'artificio": "Fireworks", "Bolle": "Bubbles", "Coriandoli": "Confetti",
    /* editor immagini */
    "Immagine troppo grande: non riesco a salvarla": "Image too large: it can't be saved",
    "Modifica immagine": "Edit image", "Un'immagine da spento (PNG) e una da acceso (meglio una GIF animata)": "One image for off (PNG) and one for on (an animated GIF works best)",
    "L'immagine mostrata per questo stato": "The image shown for this state", "Clic o trascina un file": "Click or drop a file", "Spento": "Off", "Acceso": "On", "Immagine": "Image",
    "Scegli un file immagine (PNG, JPG, GIF, WebP)": "Choose an image file (PNG, JPG, GIF, WebP)", "File troppo pesante (massimo 3 MB)": "File too large (3 MB max)",
    "Immagine aggiornata": "Image updated", "Immagine «{n}» applicata": "Image “{n}” applied", "Immagine originale ripristinata": "Original image restored",
    /* telecamere */
    "oggi": "today", "Ultimo movimento {t}": "Last motion {t}", "Immagine caricata alle {t}": "Image loaded at {t}", "Telecamera offline": "Camera offline",
    "HA non la raggiunge in questo momento": "Home Assistant can't reach it right now", "Anteprima non disponibile": "Preview unavailable", "tocca per aprire la telecamera": "tap to open the camera",
    "Diretta non disponibile": "Live view unavailable", "Stop": "Stop", "Diretta": "Live", "Aggiorna anteprima": "Refresh preview", "Apri": "Open",
    /* clima */
    "Auto": "Auto", "Freddo": "Cool", "Deumidifica": "Dry", "Ventola": "Fan", "Caldo": "Heat", "Raffrescamento": "Cooling", "Riscaldamento": "Heating",
    "Deumidificazione": "Drying", "Solo ventola": "Fan only", "Automatico": "Automatic", "Aria salone": "Air conditioner", "in pausa": "idle", "In casa {t} °C": "Indoors {t} °C",
    "Il climatizzatore non risponde: controlla la sua integrazione in Home Assistant.": "The air conditioner is not responding: check its integration in Home Assistant.",
    "Acceso ma in pausa: in casa ci sono {c}° e hai impostato {t}°. Abbassa la temperatura per far partire il raffrescamento.": "On but idle: it is {c}° indoors and you set {t}°. Lower the temperature to start cooling.",
    "Acceso ma in pausa: in casa ci sono {c}° e hai impostato {t}°. Alza la temperatura per far partire il riscaldamento.": "On but idle: it is {c}° indoors and you set {t}°. Raise the temperature to start heating.",
    "Clima: {m}": "Climate: {m}", "a {t}° (in casa {c}°)": "at {t}° (indoors {c}°)", "Clima: comando «{m}» a {t}° inviato": "Climate: “{m}” at {t}° sent",
    "Clima: comando «{m}» inviato": "Climate: “{m}” sent", "Climatizzatore non raggiungibile: nessun comando inviato": "Air conditioner unreachable: no command sent",
    /* energia */
    "in tempo reale": "live", "aggiornata ora": "updated just now", "aggiornata {n} s fa": "updated {n} s ago",
    "Lavatrice": "Washing machine", "Asciugatrice": "Dryer", "Lavastoviglie": "Dishwasher", "Forno": "Oven", "Multipresa": "Power strip", "Frigorifero": "Fridge",
    "Dato non disponibile": "Data unavailable", "Solo consumo di fondo": "Baseline only", "Consumo basso": "Low usage", "Consumo nella norma": "Normal usage",
    "Consumo alto": "High usage", "Attenzione: vicino al limite": "Warning: close to the limit",
    "Misura generale della casa · limite di avviso {l}": "Whole-house meter · warning limit {l}", "Tocca per cambiare la tariffa": "Tap to change the tariff",
    "Costa adesso": "Costs now", "Fondo": "Baseline", "Media 3 h": "3 h average", "Tensione": "Voltage",
    "Tariffa {p}": "Tariff {p}", "Tariffa non impostata": "Tariff not set", "Tariffa di esempio {p}": "Example tariff {p}",
    "Salvata in Home Assistant · ogni costo è kWh × tariffa": "Saved in Home Assistant · every cost is kWh × tariff",
    "Salvata su questo dispositivo · ogni costo è kWh × tariffa": "Saved on this device · every cost is kWh × tariff",
    "I costi arrivano dai tuoi sensori (≈ {p}). Imposta la tariffa della bolletta per i costi reali": "Costs come from your sensors (≈ {p}). Set the tariff from your bill for real costs",
    "Imposta il prezzo della tua bolletta per vedere i costi reali": "Set the price from your bill to see real costs", "Modifica": "Edit", "Imposta": "Set",
    "Oggi": "Today", "Ieri": "Yesterday", "Questo mese": "This month", "Stima fine mese ≈ {n} kWh": "End of month estimate ≈ {n} kWh", "Mese scorso": "Last month", "Quest'anno": "This year",
    "Altro (luci, standby…)": "Other (lights, standby…)", "Nessun elettrodomestico acceso": "No appliance running", "{n} kWh oggi": "{n} kWh today",
    "Costo reale:": "Real cost:", "Usa questo": "Use this", "I sensori che avevi già calcolano i costi a circa": "Your existing sensors work out costs at about",
    "Anteprima: la tariffa resta salvata solo in questo browser.": "Preview: the tariff is saved in this browser only.",
    "Viene salvata in Home Assistant ({id}): vale su tutti i tuoi dispositivi.": "It is saved in Home Assistant ({id}): it applies on all your devices.",
    "Al primo salvataggio creo in Home Assistant l'helper {id} (serve un utente amministratore); altrimenti resta su questo dispositivo.": "The first time you save, the helper {id} is created in Home Assistant (an administrator account is needed); otherwise it stays on this device.",
    "Inserisci un prezzo tra {a} e {b}": "Enter a price between {a} and {b}", "Tariffa salvata: {p}": "Tariff saved: {p}", "Tariffa salvata su questo dispositivo": "Tariff saved on this device",
    "Tariffa salvata in Home Assistant: {p}": "Tariff saved in Home Assistant: {p}", "serve un utente amministratore per salvarla in HA": "an administrator account is needed to save it in HA",
    "non sono riuscito a scriverla in HA": "it couldn't be written to HA", "Picco": "Peak", "alle": "at", "Media": "Average", "Linea tratteggiata = consumo di fondo": "Dashed line = baseline usage",
    "Costo giornaliero": "Daily cost", "Consumo giornaliero": "Daily usage", "Storico non disponibile": "History unavailable", "Totale": "Total", "Media al giorno": "Daily average",
    "Calcolato con {p}": "Worked out at {p}", "Aurora Glass v3 · collegata a Home Assistant": "Aurora Glass v3 · connected to Home Assistant",
    /* testi fissi della pagina */
    "Stile": "Style", "Cambia tema chiaro/scuro": "Switch light/dark theme", "Modalità modifica: tocca un pulsante per cambiargli immagine o GIF": "Edit mode: tap a button to change its image or GIF",
    "Fine": "Done", "Tocca scene e luci": "Tap scenes and lights", "Cambia mondo, effetti e ora": "Change world, effects and time", "Modifica le immagini": "Edit the images",
    "Simula intrusione": "Simulate intrusion", "Casa": "Home", "Lunedì 12 ottobre": "Monday 12 October", "Buonasera, Alex": "Good evening, Alex", "Esterno": "Outside",
    "Apri i consumi": "Open energy", "Consumo": "Power", "Aggiornamento in tempo reale": "Live updates", "Scene rapide": "Quick scenes", "un tocco, tutta la casa": "one tap, the whole house",
    "Luci e stanze": "Lights and rooms", "tocca l'immagine per accendere": "tap the image to switch on", "In casa 23 °C": "Indoors 23 °C", "Temperatura desiderata": "Target temperature",
    "Abbassa": "Lower", "Alza": "Raise", "Modalità": "Mode", "Alette verticali": "Vertical vanes", "Alette orizzontali": "Horizontal vanes", "Preset": "Preset",
    "Sicurezza": "Security", "ALLARME — movimento rilevato in Ingresso": "ALARM — motion detected at the Entrance", "Disattiva": "Disarm", "Centrale allarme": "Alarm panel",
    "Casa libera.": "Nobody is watching.", "Modalità allarme": "Alarm mode", "Fuori casa": "Away", "Porte, finestre e cancello": "Doors, windows and gate", "LIVE": "LIVE",
    "Giardino": "Garden", "Energia": "Energy", "Potenza adesso": "Power now", "Misura generale della casa": "Whole-house meter", "Andamento": "Trend", "Periodo": "Period",
    "3 ore": "3 hours", "24 ore": "24 hours", "7 giorni": "7 days", "Imposta la tariffa dell'energia": "Set the energy tariff", "Tariffa": "Tariff", "ultimi 14 giorni": "last 14 days",
    "Unità": "Unit", "kWh": "kWh", "Elettrodomestici": "Appliances", "consumo adesso e oggi": "power now and today",
    "Aurora Glass v3 · anteprima: non riflette dati reali di un impianto.": "Aurora Glass v3 · preview: not real data from a home.",
    "Navigazione": "Navigation", "Spegni tutto": "All off", "Personalizza lo stile": "Customise the style", "Chiudi": "Close", "Mondo": "World",
    "10 paesaggi animati, tutti con alba, giorno, tramonto e notte": "10 animated landscapes, each with dawn, day, sunset and night",
    "Ora del giorno": "Time of day", "simula cielo e colori": "preview sky and colours", "Simula l'ora del giorno": "Preview the time of day", "Usa l'ora reale": "Use the real time",
    "Meteo ed effetti": "Weather and effects", "si sovrappongono a qualsiasi mondo": "they play over any world", "Anche sullo sfondo della pagina": "On the page background too",
    "Particelle dietro a tutte le card": "Particles behind all the cards", "Effetto su tutta la pagina": "Effect on the whole page", "Sorpresa": "Surprise",
    "Cambia mondo ogni 30 secondi": "Change world every 30 seconds", "Una playlist di paesaggi": "A playlist of landscapes", "Cambia mondo automaticamente": "Change world automatically",
    "Pulsanti": "Buttons", "Immagini e GIF": "Images and GIFs", "Compatti": "Compact", "Modifica le immagini dei pulsanti": "Edit the button images", "Ripristina tutto": "Reset everything",
    "Libreria": "Library", "Puoi anche trascinare un file (PNG, JPG, GIF animata, WebP) sopra un riquadro. Le immagini scelte restano salvate in questo browser.": "You can also drop a file (PNG, JPG, animated GIF, WebP) onto a box. The images you pick are saved in this browser.",
    "Ripristina originale": "Restore original", "Fatto": "Done", "Inserisci il codice": "Enter the code", "Codice allarme": "Alarm code", "Annulla": "Cancel", "Conferma": "Confirm",
    "Costo dell'energia": "Energy cost", "Quanto paghi un kWh in bolletta": "What you pay per kWh on your bill", "Diminuisci": "Decrease", "Prezzo in euro per kWh": "Price per kWh",
    "€ / kWh": "€ / kWh", "Aumenta": "Increase", "Non lo so: calcolalo dalla bolletta": "Not sure? Work it out from your bill", "Totale da pagare": "Total to pay", "es. 84,50": "e.g. 84.50",
    "kWh consumati": "kWh used", "es. 210": "e.g. 210",
    "Dividere il totale per i kWh include anche quota fissa, trasporto e imposte: è il costo reale di ogni kWh che consumi.": "Dividing the total by the kWh also includes standing charges, delivery and taxes: it is the real cost of every kWh you use.",
    "Salva tariffa": "Save tariff"
  };
  var DICT = { en: EN };

  /* "auto" o vuoto: la lingua di Home Assistant (o del browser); tutto ciò che non è italiano diventa inglese */
  function pick(lang) {
    var l = String(lang || "").toLowerCase();
    if (!l || l === "auto") l = (document.documentElement.lang || navigator.language || "it").toLowerCase();
    return l.indexOf("it") === 0 ? "it" : "en";
  }

  g.AuroraI18n = {
    pick: pick,
    dict: DICT,
    make: function (lang) {
      var code = pick(lang), D = DICT[code] || null;
      function T(s, v) {
        var r = D && D[s] !== undefined ? D[s] : s;
        if (v) r = r.replace(/\{(\w+)\}/g, function (m, k) { return v[k] !== undefined && v[k] !== null ? v[k] : m; });
        return r;
      }
      T.lang = code;
      T.loc = code === "it" ? "it-IT" : "en-GB";
      /* traduce i testi fissi già presenti nella pagina (nodi di testo e attributi) */
      T.dom = function (root) {
        if (!D) return;
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
        while ((n = w.nextNode())) list.push(n);
        list.forEach(function (t) {
          var p = t.parentNode && t.parentNode.nodeName;
          if (p === "STYLE" || p === "SCRIPT") return;
          var raw = t.nodeValue, key = raw.replace(/\s+/g, " ").trim();
          if (key && D[key] !== undefined) t.nodeValue = raw.replace(raw.trim(), D[key]);
        });
        var all = root.querySelectorAll ? root.querySelectorAll("[aria-label],[title],[placeholder]") : [];
        Array.prototype.forEach.call(all, function (e) {
          ["aria-label", "title", "placeholder"].forEach(function (a) { var v = e.getAttribute(a); if (v && D[v] !== undefined) e.setAttribute(a, D[v]); });
        });
      };
      return T;
    }
  };
})(window);
