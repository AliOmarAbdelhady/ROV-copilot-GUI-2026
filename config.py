PLATFORMS = [
    {
        "id": "hibernia",
        "name": "Hibernia",
        "latitude": 46.7504,
        "longitude": -48.7819,
        "depth_m": 78,
        "label": "46°45'02\"N 48°46'59\"W",
    },
    {
        "id": "hebron",
        "name": "Hebron",
        "latitude": 46.544,
        "longitude": -48.518,
        "depth_m": 93,
        "label": "46°32'11\"N 48°30'46\"W",
    },
    {
        "id": "sea_rose",
        "name": "Sea Rose",
        "latitude": 46.7895,
        "longitude": -48.146,
        "depth_m": 107,
        "label": "46°47'19\"N 48°08'36\"W",
    },
    {
        "id": "terra_nova",
        "name": "Terra Nova",
        "latitude": 46.4,
        "longitude": -48.4,
        "depth_m": 91,
        "label": "46°23'21\"N 48°28'46\"W",
    },
]

FREQUENCY_SPECIES = [
    {
        "id": "snow_crab",
        "name": "Snow crab",
        "scientific_name": "chionecetes opilio",
    },
    {
        "id": "acadian_hermit_crab",
        "name": "Acadian hermit crab",
        "scientific_name": "Pagarus acadianus",
    },
    {
        "id": "western_atlantic_hairy_hermit_crab",
        "name": "Western Atlantic Hairy Hermit Crab",
        "scientific_name": "Pagarus arcuatus",
    },
    {
        "id": "european_green_crab",
        "name": "European Green Crab",
        "scientific_name": "Carcinus maenas",
    },
    {
        "id": "rock_crab",
        "name": "Rock Crab",
        "scientific_name": "Cancer pagurus",
    },
    {
        "id": "jonah_crab",
        "name": "Jonah Crab",
        "scientific_name": "Cancer borealis",
    },
    {
        "id": "spiny_sunstar",
        "name": "Spiny Sunstar",
        "scientific_name": "Crossaster papposus",
    },
    {
        "id": "sea_urchin",
        "name": "Sea Urchin",
        "scientific_name": "Stronglyocentrotus droebachiensis",
    },
    {
        "id": "boreal_sea_star",
        "name": "Boreal Sea Star",
        "scientific_name": "Boreal asterias",
    },
    {
        "id": "daisy_brittle_star",
        "name": "Daisy brittle star",
        "scientific_name": "Ophiopholis aculeata",
    },
]

# Surface platform threat thresholds in nautical miles
THREAT_GREEN_THRESHOLD = 10
THREAT_YELLOW_THRESHOLD = 5

# 2026 MATE subsea guidance:
# only tracks within 25 nm are considered for subsea assets, then keel-depth ratio
# determines the risk band.
SUBSEA_INTERSECTION_THRESHOLD_NM = 25
SUBSEA_GROUNDING_RATIO = 1.10
SUBSEA_RED_RATIO = 0.90
SUBSEA_YELLOW_RATIO = 0.70

# Nautical mile in meters
NM_IN_METERS = 1852.0

# Earth radius in meters
EARTH_RADIUS_M = 6_371_000

# Default map center (Grand Banks, Newfoundland)
MAP_CENTER = [46.7, -48.5]
MAP_ZOOM = 7
