AURORA GLASS v3 for Home Assistant
==================================
The animated dashboard: a sky that follows the time of day, 10 worlds, 11 weather
effects, buttons made of images and GIFs, alarm, climate, cameras and energy with
costs. In English or Italian, with YOUR rooms and the names you choose.

Two ways to install it. The first one needs no YAML at all.


METHOD A - GUIDED INSTALL (recommended)
---------------------------------------
With HACS:
  1) HACS -> menu (three dots) -> Custom repositories
     Repository:  https://github.com/lucalux00/aurora-glass    Type: Integration
  2) Search "Aurora Glass" -> Download.
  3) Restart Home Assistant (Settings -> System -> top-right menu -> Restart).

Without HACS:
  1) Copy the folder  custom_components/aurora_glass  from this package into your
     Home Assistant configuration folder (File editor, Samba or Studio Code Server).
     Result:  custom_components/aurora_glass/manifest.json
  2) Restart Home Assistant.

After the restart:
  4) Home Assistant finds it by itself: a notification appears and at the top of
     Settings -> Devices & services "Aurora Glass" is listed as discovered.
     Press "Add".
     (Don't see it? Settings -> Devices & services -> Add integration -> search
     "Aurora Glass".)
  5) The wizard asks, one screen at a time:
       - the dashboard name, icon and language (automatic, English, Italian)
       - your rooms: it suggests the Home Assistant areas that have lights. For each
         room type the name you want to see and check lights, motion sensors, doors and
         windows and temperature (already filled in: you only remove or add).
         You can also add rooms that have no area.
       - alarm, weather, air conditioner, whole-house power and energy, cameras
       - what the Good morning, Cinema and Dinner scenes turn on
  6) Done: the sidebar shows an entry with the name you picked. Open it.

To change something later: Settings -> Devices & services -> Aurora Glass -> Configure
(name and language, rooms, devices, scenes). The dashboard updates by itself.
Want more dashboards (for example one for the bedroom tablet)? Add service.


METHOD B - BY HAND WITH YAML
----------------------------
  1) COPY THE FILES: put the folder  www/aurora-v3  from the package into the  www
     folder of Home Assistant. Result: www/aurora-v3/aurora-v3.js and www/aurora-v3/btn/...
     If www is new, restart Home Assistant once.
     Test: open  <your HA address>/local/aurora-v3/aurora-v3.js : if you see text, all good.
  2) ADD THE RESOURCE: Settings -> Dashboards -> menu (three dots) -> Resources ->
     Add resource.  URL: /local/aurora-v3/aurora-v3.js?v=1   Type: JavaScript module
     (when you update the card, raise the number after ?v=)
  3) CREATE THE DASHBOARD: Settings -> Dashboards -> Add dashboard -> New dashboard from
     scratch. Title "Aurora", icon mdi:home-heart, "Show in sidebar".
  4) PASTE THE CARD: open the dashboard -> pencil -> menu -> "Raw configuration editor"
     -> delete everything, paste  dashboard-example.yaml  -> Save.
  5) YOUR ROOMS: in dashboard-example.yaml change the  rooms:  section with your room
     names and your entities (Settings -> Developer tools -> States, filter "light.").
     card-example.yaml lists EVERY option, with comments.
  6) ENERGY (optional): set your power sensor (W) and total energy meter (kWh).
     Today, yesterday, month and year kWh are worked out from Home Assistant's history;
     if you prefer real meters use aurora-energy.yaml.
     In the Energy view tap the "Tariff" bar and enter what you pay per kWh.


TROUBLESHOOTING
 - Red card "Custom element doesn't exist": check the resource and hard-refresh (Ctrl+F5).
 - Empty pictures (method B): "assets" must be /local/aurora-v3/btn/ (with the trailing slash).
 - Grey lights: the entity doesn't exist or the device is offline.
 - No sidebar entry after the wizard: reload the page (Ctrl+F5).
 - Costs at zero: tap the Tariff bar.

PRIVACY
 Everything runs locally. The only external request is Google Fonts (Manrope, Sora).
 No data is collected or sent anywhere.

REMOVE
 Method A: Settings -> Devices & services -> Aurora Glass -> Delete, then remove the
 integration from HACS (or the folder custom_components/aurora_glass).
 Method B: delete the dashboard, the resource and the folder www/aurora-v3.

GPL-3.0 licence: you can use, modify and share the card, commercially too, as long as
modified versions stay GPL-3.0, ship their source code and use a name other than
"Aurora Glass". See LICENSE.
(c) 2026 DomotikPro.it (Luca Pinelli) - https://domotikpro.it/progetti/aurora-glass-v3
