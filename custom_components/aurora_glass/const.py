"""Costanti dell'integrazione Aurora Glass."""

DOMAIN = "aurora_glass"
VERSION = "3.1.2"

# file della scheda e immagini dei pulsanti, serviti da Home Assistant
URL_BASE = "/aurora_glass"
PANEL_ELEMENT = "aurora-glass-panel"

CONF_NAME = "name"
CONF_ICON = "icon"
CONF_LANGUAGE = "language"
CONF_URL_PATH = "url_path"
CONF_ROOMS = "rooms"
CONF_DEVICES = "devices"
CONF_SCENES = "scenes"

DEFAULT_NAME = "Aurora"
DEFAULT_ICON = "mdi:home-heart"
LANGUAGES = ["auto", "it", "en"]

# immagini dei pulsanti luce disponibili nella libreria della scheda
LIGHT_IMAGES = [
    "salotto", "cucina", "camera", "cameretta", "bagno_doccia", "bagno_piccolo",
    "ingresso", "corridoio", "balcone", "lavanderia", "sgabuzzino",
]

# parole che fanno scegliere l'immagine giusta dal nome della stanza (italiano e inglese)
IMAGE_HINTS = [
    ("cucina", ("cucin", "kitchen", "cottur", "dining", "pranzo")),
    ("cameretta", ("cameret", "bimb", "child", "kid", "nursery", "bambin", "ragazz")),
    ("camera", ("camera", "letto", "bed", "notte", "sleep", "master", "ospit", "guest")),
    ("bagno_doccia", ("doccia", "shower", "vasca", "bath")),
    ("bagno_piccolo", ("bagno", "wc", "toilet", "restroom", "lavabo")),
    ("corridoio", ("corrido", "hallway", "scal", "stair", "disimpegn", "landing", "passag")),
    ("ingresso", ("ingress", "entr", "hall", "porta", "door", "foyer")),
    ("balcone", ("balcon", "terrazz", "terrace", "patio", "giardin", "garden", "portic", "porch", "outdoor", "estern", "yard", "cortil")),
    ("lavanderia", ("lavander", "laundry", "lavatric", "utility")),
    ("sgabuzzino", ("sgabuzz", "ripost", "storage", "closet", "cantin", "cellar", "garage", "soffitt", "attic", "ufficio", "office", "studio", "study")),
    ("salotto", ("salot", "soggiorn", "living", "lounge", "salon", "tv", "divan", "sofa")),
]

CURRENCY_SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£", "CHF": "CHF", "JPY": "¥", "INR": "₹", "AUD": "$", "CAD": "$", "NZD": "$"}
