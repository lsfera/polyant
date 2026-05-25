---
name: weather
description: Look up current weather and forecasts via OpenWeatherMap.
requiredEnv:
  - name: OPENWEATHER_API_KEY
    description: API key for OpenWeatherMap. Get one at https://openweathermap.org/api
    sensitive: true
---

# Weather Skill

When the user asks about current weather or a short-term forecast, use this skill.

## How to use

Use the `httpRequest` tool to call the OpenWeatherMap API:

```
GET https://api.openweathermap.org/data/2.5/weather?q=<city>&appid=<OPENWEATHER_API_KEY>&units=metric
```

Your `OPENWEATHER_API_KEY` is available in the skill environment — it has already been substituted into the `<skill_env>` block above.

## Response format

Return:
- Temperature (°C) and "feels like"
- Current condition (clear, rain, etc.)
- Humidity percentage
- Wind speed (m/s)

Keep the answer to 2-3 lines unless the user asks for more detail.

## Caveats

- If the city is ambiguous, ask for country code (e.g. "London, UK" vs "London, CA")
- The free tier rate-limits to 60 calls/minute. If you get 429, tell the user to retry in a minute.
