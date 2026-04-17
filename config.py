import math

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
    {
        "id": "hebron",
        "name": "Hebron",
        "latitude": 46.544,
        "longitude": -48.518,
        "depth_m": 93,
        "label": "46°32'11\"N 48°30'46\"W",
    },
]

EXAMPLE_ICEBERGS = [
    {
        "id": "A",
        "name": "Example A",
        "latitude": 47.65,
        "longitude": -48.6167,
        "heading": 158,
        "keel_depth_m": 99,
        "is_example": True,
    },
    {
        "id": "B",
        "name": "Example B",
        "latitude": 47.9667,
        "longitude": -48.8333,
        "heading": 180,
        "keel_depth_m": 78,
        "is_example": True,
    },
    {
        "id": "C",
        "name": "Example C",
        "latitude": 47.8833,
        "longitude": -47.85,
        "heading": 188,
        "keel_depth_m": 112,
        "is_example": True,
    },
    {
        "id": "D",
        "name": "Example D",
        "latitude": 47.6667,
        "longitude": -49.4167,
        "heading": 152,
        "keel_depth_m": 60,
        "is_example": True,
    },
    {
        "id": "E",
        "name": "Example E",
        "latitude": 47.75,
        "longitude": -48.4833,
        "heading": 198,
        "keel_depth_m": 84,
        "is_example": True,
    },
    {
        "id": "F",
        "name": "Example F",
        "latitude": 47.9333,
        "longitude": -47.75,
        "heading": 181,
        "keel_depth_m": 126,
        "is_example": True,
    },
]

# Threat thresholds in nautical miles
THREAT_GREEN_THRESHOLD = 10   # > 10 nm = green
THREAT_YELLOW_THRESHOLD = 5   # 5-10 nm = yellow, < 5 nm = red

# Nautical mile in meters
NM_IN_METERS = 1852.0

# Earth radius in meters
EARTH_RADIUS_M = 6_371_000

# Default map center (Grand Banks, Newfoundland)
MAP_CENTER = [46.7, -48.5]
MAP_ZOOM = 7
