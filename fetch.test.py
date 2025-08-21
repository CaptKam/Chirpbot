import requests

Example MLB endpoint (adjust to your actual URL)
mlb_url = "https://statsapi.mlb.com/api/v1/schedule"
sportsdata_url = "https://api.sportsdata.io/v3/mlb/scores/json/GamesByDate/{date}"

Add your API keys if needed
headers = {"Ocp-Apim-Subscription-Key": "YOUR_SPORTSDATA_API_KEY"}

Fetch from MLB
mlb_response = requests.get(mlb_url)
if mlb_response.status_code == 200:
print("MLB Data Sample:", mlb_response.json())

Fetch from SportsData
sportsdata_response = requests.get(sportsdata_url.replace("{date}", "2024-06-10"), headers=headers)
if sportsdata_response.status_code == 200:
print("SportsData Sample:", sportsdata_response.json())