# Aurora Glass — animated dashboard for Home Assistant, with a setup wizard

🇮🇹 [Leggi in italiano](README.it.md)

![Aurora Glass](docs/dashboard-casa-notte-intera.webp)

A living dashboard: the sky, sun, moon and the windows of the little house follow the real time of day, ten animated worlds, eleven weather effects, buttons made of images and GIFs, alarm, climate, cameras and an energy view with costs from your own tariff.

Install it from HACS, restart, and a **wizard** builds the dashboard for you: it finds your rooms from your Home Assistant areas, lets you rename them, and adds the dashboard to the **sidebar**. No YAML. English and Italian.

- **Live demo (no install):** https://domotikpro.it/aurora-glass-v3-demo/index.html?lang=en
- **Guide (Italian):** https://domotikpro.it/progetti/aurora-glass-v3

| The wizard | One room at a time |
|---|---|
| ![Name and language](docs/wizard-dashboard.webp) | ![Room](docs/wizard-room.webp) |

## Install
1. **HACS** → ⋮ → *Custom repositories* → add `https://github.com/lucalux00/aurora-glass`, type **Integration** → search **Aurora Glass** → *Download*.
2. **Restart** Home Assistant.
3. Home Assistant finds Aurora Glass by itself: open **Settings → Devices & services**, it is listed as *Discovered* → **Add**. (Or *Add integration* → *Aurora Glass*.)
4. Follow the wizard:
   - **Your dashboard** — sidebar name, icon, language (automatic, English, Italian).
   - **Rooms** — the areas that have lights are already selected. For each room type the name you want and check lights, motion sensors, doors/windows/locks and temperature (pre-filled). Rooms without an area can be added too.
   - **Your home** — alarm panel, weather, air conditioner, whole-house power (W) and energy (kWh), cameras, currency. Leave a field empty to hide that part.
   - **Quick scenes** — what *Good morning*, *Cinema* and *Dinner* turn on (lights, or a scene/script).
5. The new entry appears in the sidebar. Done.

Change anything later from **Settings → Devices & services → Aurora Glass → Configure**. Want a second dashboard (e.g. for a wall tablet)? *Add entry*.

Without HACS: copy `custom_components/aurora_glass` into your config folder and restart. The [download package](https://domotikpro.it/progetti/aurora-glass-v3) also contains an `english/` folder with a step-by-step guide and YAML examples for a manual install.

## Features
- 10 animated worlds and 11 weather effects (rain, snow, storm, fireflies, petals, fireworks…)
- Sky and colours follow the real time of day
- Your rooms, your names: as many rooms and lights as you have
- 50 ready-made button images and GIFs (lights, scenes, sensors, alarm, climate), editable from the dashboard
- Alarm panel with code, climate control, cameras with live view
- Energy view: live power, kWh today / yesterday / month / year (worked out from your meter's history, no extra sensors needed) and costs = kWh × your tariff
- English and Italian; automatic mode follows each user's language
- **Privacy:** everything runs locally. The only external request is Google Fonts (Manrope, Sora).

## Use the card in your own dashboards
The integration also loads the card everywhere, so you can use it in any dashboard (panel view recommended):

```yaml
type: custom:aurora-v3-card
language: en
rooms:
  - name: Living room
    lights: [light.living_room, light.sofa_lamp]
    motion: binary_sensor.living_room_motion
    openings: [binary_sensor.front_door]
    temperature: sensor.living_room_temperature
  - name: Kitchen
    lights: [light.kitchen]
entities:
  alarm: alarm_control_panel.home
  weather: weather.forecast_home
  energy:
    power: sensor.house_power
    energyTotal: sensor.house_energy
```

Every option is in [`package/english/card-example.yaml`](package/english/card-example.yaml).

## Troubleshooting
- *No sidebar entry after the wizard* — reload the page (Ctrl+F5).
- *Grey lights* — the device is offline or the entity was removed: *Configure → Rooms*.
- *Costs at zero* — tap the *Tariff* bar in the Energy view and enter your price per kWh.

## Remove
Settings → Devices & services → Aurora Glass → Delete, then remove it from HACS.

## For developers
The card sources are in `src/` (open `src/index.html` for the preview, `src/tests/harness.html` for a simulated Home Assistant). `python tools/build.py` builds the integration's frontend, `dist/` and the download zip.

## License
[GPL-3.0](LICENSE). You can use, study, modify and share it, commercially too, as long as every modified version you distribute stays under GPL-3.0, comes with its source code and keeps the original notice: © 2026 DomotikPro.it (Luca Pinelli).

The name "Aurora Glass" and the DomotikPro.it brand are not covered by the license: a modified version must use a different name.

---
Made by [DomotikPro.it](https://domotikpro.it) — practical guides for a reliable smart home.
