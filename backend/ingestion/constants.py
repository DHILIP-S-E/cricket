"""Static mappings used throughout the ingestion pipeline."""

# Cricsheet event name → our tournament_name_enum
EVENT_TO_TOURNAMENT: dict[str, str] = {
    "Indian Premier League": "IPL",
    "IPL": "IPL",
    "Big Bash League": "BBL",
    "Pakistan Super League": "PSL",
    "Caribbean Premier League": "CPL",
    "SA20": "SA20",
    "International League T20": "ILT20",
    "Major League Cricket": "MLC",
    "ICC Men's T20 World Cup": "T20I",
    "ICC T20 World Cup": "T20I",
    "Men's T20 International": "T20I",
    "T20 International": "T20I",
    "Tamil Nadu Premier League": "TNPL",
    "Karnataka Premier League": "KPL",
}

# Cricsheet league key → download URL
CRICSHEET_URLS: dict[str, str] = {
    "ipl":  "https://cricsheet.org/downloads/ipl_male_json.zip",
    "t20i": "https://cricsheet.org/downloads/t20s_male_json.zip",
    "bbl":  "https://cricsheet.org/downloads/bbl_male_json.zip",
    "psl":  "https://cricsheet.org/downloads/psl_male_json.zip",
    "cpl":  "https://cricsheet.org/downloads/cpl_male_json.zip",
    "sa20": "https://cricsheet.org/downloads/sa20_male_json.zip",
    "ilt20": "https://cricsheet.org/downloads/ilt20_male_json.zip",
}

# Canonical team names (handles renames across IPL seasons)
TEAM_CANONICAL: dict[str, str] = {
    "Mumbai Indians": "Mumbai Indians",
    "Chennai Super Kings": "Chennai Super Kings",
    "Royal Challengers Bangalore": "Royal Challengers Bengaluru",
    "Royal Challengers Bengaluru": "Royal Challengers Bengaluru",
    "Kolkata Knight Riders": "Kolkata Knight Riders",
    "Delhi Capitals": "Delhi Capitals",
    "Delhi Daredevils": "Delhi Capitals",
    "Rajasthan Royals": "Rajasthan Royals",
    "Sunrisers Hyderabad": "Sunrisers Hyderabad",
    "Punjab Kings": "Punjab Kings",
    "Kings XI Punjab": "Punjab Kings",
    "Gujarat Titans": "Gujarat Titans",
    "Lucknow Super Giants": "Lucknow Super Giants",
    "Deccan Chargers": "Deccan Chargers",
    "Pune Warriors": "Pune Warriors",
    "Kochi Tuskers Kerala": "Kochi Tuskers Kerala",
    "Rising Pune Supergiants": "Rising Pune Supergiants",
    "Rising Pune Supergiant": "Rising Pune Supergiants",
}

TEAM_SHORT_NAME: dict[str, str] = {
    "Mumbai Indians": "MI",
    "Chennai Super Kings": "CSK",
    "Royal Challengers Bengaluru": "RCB",
    "Kolkata Knight Riders": "KKR",
    "Delhi Capitals": "DC",
    "Rajasthan Royals": "RR",
    "Sunrisers Hyderabad": "SRH",
    "Punjab Kings": "PBKS",
    "Gujarat Titans": "GT",
    "Lucknow Super Giants": "LSG",
    "Deccan Chargers": "DCH",
    "Pune Warriors": "PW",
    "Kochi Tuskers Kerala": "KTK",
    "Rising Pune Supergiants": "RPS",
}

# Cricsheet wicket kind → our wicket_type_enum
WICKET_TYPE_MAP: dict[str, str | None] = {
    "caught": "Caught",
    "caught and bowled": "Caught",
    "bowled": "Bowled",
    "lbw": "LBW",
    "run out": "Run-out",
    "stumped": "Stumped",
    "hit wicket": "Hit Wicket",
    "obstructing the field": "Obstructing the field",
    "handled the ball": "Handled the ball",
    "timed out": "Timed out",
    "retired hurt": None,
    "retired out": None,
}

# Over ranges for phase detection
POWERPLAY_OVERS = range(0, 6)    # overs 0–5 (1st–6th over)
MIDDLE_OVERS    = range(6, 15)   # overs 6–14
DEATH_OVERS     = range(15, 20)  # overs 15–19

# Default player nationality when not determinable from data
DEFAULT_NATIONALITY = "Other"

# Base prices for players with no auction history (INR crore)
BASE_PRICE_BY_ROLE: dict[str, float] = {
    "Top-order Batter": 0.50,
    "Middle-order Batter": 0.50,
    "Batting All-rounder": 1.00,
    "Bowling All-rounder": 1.00,
    "Wicket-keeper Batter": 0.50,
    "Pace Bowler": 0.50,
    "Spin Bowler": 0.50,
}
