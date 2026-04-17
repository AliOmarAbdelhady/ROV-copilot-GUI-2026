import math
from config import (
    PLATFORMS,
    EXAMPLE_ICEBERGS,
    THREAT_GREEN_THRESHOLD,
    THREAT_YELLOW_THRESHOLD,
    NM_IN_METERS,
    EARTH_RADIUS_M,
)


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lon points using Haversine formula."""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))
    return EARTH_RADIUS_M * c


def distance_nm(pos1, pos2):
    """Distance in nautical miles between two {latitude, longitude} dicts."""
    m = haversine(pos1["latitude"], pos1["longitude"], pos2["latitude"], pos2["longitude"])
    return m / NM_IN_METERS


def bearing_from_to(pos1, pos2):
    """Initial bearing in degrees from pos1 to pos2."""
    lat1 = math.radians(pos1["latitude"])
    lat2 = math.radians(pos2["latitude"])
    dlon = math.radians(pos2["longitude"] - pos1["longitude"])
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination_point(lat, lon, bearing_deg, distance_nm_val):
    """Calculate destination point given start, bearing, and distance in nm."""
    dist_m = distance_nm_val * NM_IN_METERS
    d = dist_m / EARTH_RADIUS_M
    brng = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(
        math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brng)
    )
    lon2 = lon1 + math.atan2(
        math.sin(brng) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lon2)


def angular_difference(a, b):
    """Smallest angle difference between two bearings in degrees."""
    diff = (a - b + 180) % 360 - 180
    return abs(diff)


def closest_approach_distance(iceberg, platform):
    """
    Estimate the closest approach distance in nm of an iceberg to a platform.
    Projects the iceberg along its heading and finds the closest point.
    """
    dist_direct = distance_nm(iceberg, platform)
    bearing_to_platform = bearing_from_to(iceberg, platform)
    angle_diff = angular_difference(iceberg["heading"], bearing_to_platform)

    # If iceberg is heading generally toward the platform (within 90 degrees),
    # the closest approach is the perpendicular distance
    if angle_diff < 90:
        # Closest approach = direct distance * sin(angle)
        perpendicular_dist = dist_direct * math.sin(math.radians(angle_diff))
        return perpendicular_dist
    else:
        # Iceberg heading away from platform — current position is closest
        return dist_direct


def will_ground(iceberg_keel_m, platform_depth_m):
    """Check if iceberg will ground before reaching platform depth."""
    return iceberg_keel_m >= platform_depth_m


def classify_threat(distance):
    """Classify threat level based on distance in nautical miles."""
    if distance < THREAT_YELLOW_THRESHOLD:
        return "red"
    elif distance < THREAT_GREEN_THRESHOLD:
        return "yellow"
    return "green"


def platform_threat(iceberg, platform):
    """Determine surface platform threat level."""
    closest_dist = closest_approach_distance(iceberg, platform)
    return classify_threat(closest_dist), closest_dist


def subsea_threat(iceberg, platform):
    """
    Determine subsea asset threat level.
    Considers trajectory intersection, keel depth, and grounding analysis.
    """
    bearing_to_platform = bearing_from_to(iceberg, platform)
    angle_diff = angular_difference(iceberg["heading"], bearing_to_platform)
    closest_dist = closest_approach_distance(iceberg, platform)

    if angle_diff > 90:
        return "green", "does not intersect"

    keel = iceberg["keel_depth_m"]
    depth = platform["depth_m"]

    if will_ground(keel, depth):
        if closest_dist < 5:
            return "red", "iceberg will ground"
        elif closest_dist < 10:
            return "yellow", "iceberg will ground"
        return "green", "iceberg will ground"

    if keel < depth * 0.75:
        return "green", "insufficient keel depth"

    if keel < depth:
        base = classify_threat(closest_dist)
        if base == "red":
            return "yellow", ""
        return "green", "insufficient keel depth"

    return classify_threat(closest_dist), ""


def predict_trajectory_points(iceberg, distance_nm_max=60, step_nm=2):
    """Generate trajectory points along iceberg heading."""
    points = []
    steps = int(distance_nm_max / step_nm)
    for i in range(steps + 1):
        dist = i * step_nm
        lat, lon = destination_point(
            iceberg["latitude"], iceberg["longitude"], iceberg["heading"], dist
        )
        points.append({"lat": lat, "lon": lon, "distance_nm": dist})
    return points


def assess_all_threats(icebergs=None, platforms=None):
    """Run full threat assessment. Returns structured results."""
    if icebergs is None:
        icebergs = EXAMPLE_ICEBERGS
    if platforms is None:
        platforms = PLATFORMS

    results = []
    for iceberg in icebergs:
        iceberg_result = {
            "iceberg": iceberg,
            "platform_threats": {},
            "subsea_threats": {},
        }
        for platform in platforms:
            p_threat, p_dist = platform_threat(iceberg, platform)
            s_threat, s_note = subsea_threat(iceberg, platform)
            iceberg_result["platform_threats"][platform["id"]] = {
                "level": p_threat,
                "distance_nm": round(p_dist, 2),
                "platform_name": platform["name"],
            }
            iceberg_result["subsea_threats"][platform["id"]] = {
                "level": s_threat,
                "note": s_note,
                "platform_name": platform["name"],
            }
        results.append(iceberg_result)
    return results


def threat_summary(results):
    """Aggregate threat counts for dashboard."""
    summary = {"red": 0, "yellow": 0, "green": 0}
    per_platform = {p["id"]: {"name": p["name"], "red": 0, "yellow": 0, "green": 0} for p in PLATFORMS}

    for r in results:
        for pid, threat in r["platform_threats"].items():
            level = threat["level"]
            summary[level] += 1
            per_platform[pid][level] += 1

    return {"total": summary, "per_platform": per_platform}
