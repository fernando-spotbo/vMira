//! Weather service using Open-Meteo (free, no API key, global coverage).

use serde::{Deserialize, Serialize};

// ── Public types ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct WeatherResponse {
    pub city: String,
    pub temperature: f64,
    pub feels_like: f64,
    pub description: String,
    pub icon: String,
    pub wind_speed: f64,
    pub wind_gusts: Option<f64>,
    pub humidity: Option<f64>,
    pub uv_index: Option<f64>,
    pub precipitation_probability: Option<f64>,
    pub precipitation_sum: Option<f64>,
    pub sunrise: Option<String>,
    pub sunset: Option<String>,
    pub is_day: bool,
    pub hourly: Vec<HourlyPoint>,
    pub forecast: Vec<ForecastDay>,
}

#[derive(Debug, Serialize, Clone)]
pub struct HourlyPoint {
    pub time: String,        // "14:00"
    pub temp: f64,
    pub icon: String,
    pub precip_prob: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ForecastDay {
    pub day: String,
    pub temp_max: f64,
    pub temp_min: f64,
    pub icon: String,
    pub code: i64,
    pub precip_prob: Option<f64>,
    pub precip_sum: Option<f64>,
    pub wind_max: Option<f64>,
    pub uv_max: Option<f64>,
    pub sunrise: Option<String>,
    pub sunset: Option<String>,
}

// ── Internal deserialization types ───────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GeoResult { results: Option<Vec<GeoEntry>> }

#[derive(Debug, Deserialize)]
struct GeoEntry { latitude: f64, longitude: f64, name: String, country: Option<String> }

#[derive(Debug, Deserialize)]
struct MeteoResponse {
    current_weather: Option<CurrentWeather>,
    daily: Option<DailyData>,
    hourly: Option<HourlyData>,
}

#[derive(Debug, Deserialize)]
struct CurrentWeather {
    temperature: f64,
    windspeed: f64,
    weathercode: i64,
    is_day: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct DailyData {
    time: Vec<String>,
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    weathercode: Vec<i64>,
    apparent_temperature_max: Option<Vec<f64>>,
    relative_humidity_2m_max: Option<Vec<f64>>,
    precipitation_probability_max: Option<Vec<f64>>,
    precipitation_sum: Option<Vec<f64>>,
    windspeed_10m_max: Option<Vec<f64>>,
    windgusts_10m_max: Option<Vec<f64>>,
    uv_index_max: Option<Vec<f64>>,
    sunrise: Option<Vec<String>>,
    sunset: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct HourlyData {
    time: Vec<String>,
    temperature_2m: Vec<f64>,
    weathercode: Vec<i64>,
    precipitation_probability: Option<Vec<f64>>,
}

// ── Fetch ────────────────────────────────────────────────────────────────

pub async fn get_weather(city: &str) -> Result<WeatherResponse, String> {
    let client = reqwest::Client::new();

    // Geocode
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=ru",
        urlencoding::encode(city)
    );
    let geo: GeoResult = client.get(&geo_url)
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("Geocoding: {e}"))?
        .json().await.map_err(|e| format!("Geocoding parse: {e}"))?;

    let entry = geo.results.and_then(|r| r.into_iter().next())
        .ok_or_else(|| format!("City not found: {city}"))?;

    // Fetch weather — all available fields
    let weather_url = format!(
        "https://api.open-meteo.com/v1/forecast?\
         latitude={}&longitude={}\
         &current_weather=true\
         &daily=temperature_2m_max,temperature_2m_min,weathercode,\
         apparent_temperature_max,relative_humidity_2m_max,\
         precipitation_probability_max,precipitation_sum,\
         windspeed_10m_max,windgusts_10m_max,uv_index_max,\
         sunrise,sunset\
         &hourly=temperature_2m,weathercode,precipitation_probability\
         &timezone=auto&forecast_days=5\
         &forecast_hours=24",
        entry.latitude, entry.longitude
    );
    let meteo: MeteoResponse = client.get(&weather_url)
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("Weather: {e}"))?
        .json().await.map_err(|e| format!("Weather parse: {e}"))?;

    let current = meteo.current_weather.ok_or("No current weather")?;
    let daily = meteo.daily.ok_or("No daily data")?;

    let feels_like = daily.apparent_temperature_max.as_ref()
        .and_then(|v| v.first().copied()).unwrap_or(current.temperature);
    let humidity = daily.relative_humidity_2m_max.as_ref()
        .and_then(|v| v.first().copied());
    let precip_prob = daily.precipitation_probability_max.as_ref()
        .and_then(|v| v.first().copied());
    let precip_sum = daily.precipitation_sum.as_ref()
        .and_then(|v| v.first().copied());
    let wind_gusts = daily.windgusts_10m_max.as_ref()
        .and_then(|v| v.first().copied());
    let uv_index = daily.uv_index_max.as_ref()
        .and_then(|v| v.first().copied());
    let sunrise = daily.sunrise.as_ref()
        .and_then(|v| v.first().cloned())
        .map(|s| extract_time(&s));
    let sunset = daily.sunset.as_ref()
        .and_then(|v| v.first().cloned())
        .map(|s| extract_time(&s));

    let city_display = if let Some(country) = &entry.country {
        format!("{}, {}", entry.name, country)
    } else {
        entry.name.clone()
    };

    // Hourly (next 12 hours, every 2h)
    let hourly = if let Some(ref h) = meteo.hourly {
        h.time.iter().enumerate()
            .filter(|(i, _)| i % 2 == 0 && *i < 24)
            .map(|(i, t)| {
                let code = h.weathercode.get(i).copied().unwrap_or(0);
                HourlyPoint {
                    time: extract_time(t),
                    temp: h.temperature_2m.get(i).copied().unwrap_or(0.0),
                    icon: weather_icon(code),
                    precip_prob: h.precipitation_probability.as_ref()
                        .and_then(|v| v.get(i).copied()),
                }
            })
            .collect()
    } else {
        vec![]
    };

    // Daily forecast
    let weekdays_ru = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    let forecast: Vec<ForecastDay> = daily.time.iter().enumerate().map(|(i, date_str)| {
        let day_name = if i == 0 {
            "Сегодня".to_string()
        } else if i == 1 {
            "Завтра".to_string()
        } else {
            chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                .map(|d| { use chrono::Datelike; weekdays_ru[d.weekday().num_days_from_sunday() as usize].to_string() })
                .unwrap_or_else(|_| date_str.clone())
        };
        let code = daily.weathercode.get(i).copied().unwrap_or(0);
        ForecastDay {
            day: day_name,
            temp_max: daily.temperature_2m_max.get(i).copied().unwrap_or(0.0),
            temp_min: daily.temperature_2m_min.get(i).copied().unwrap_or(0.0),
            icon: weather_icon(code),
            code,
            precip_prob: daily.precipitation_probability_max.as_ref().and_then(|v| v.get(i).copied()),
            precip_sum: daily.precipitation_sum.as_ref().and_then(|v| v.get(i).copied()),
            wind_max: daily.windspeed_10m_max.as_ref().and_then(|v| v.get(i).copied()),
            uv_max: daily.uv_index_max.as_ref().and_then(|v| v.get(i).copied()),
            sunrise: daily.sunrise.as_ref().and_then(|v| v.get(i).cloned()).map(|s| extract_time(&s)),
            sunset: daily.sunset.as_ref().and_then(|v| v.get(i).cloned()).map(|s| extract_time(&s)),
        }
    }).collect();

    Ok(WeatherResponse {
        city: city_display,
        temperature: current.temperature,
        feels_like,
        description: weather_description(current.weathercode),
        icon: weather_icon(current.weathercode),
        wind_speed: current.windspeed,
        wind_gusts,
        humidity,
        uv_index,
        precipitation_probability: precip_prob,
        precipitation_sum: precip_sum,
        sunrise,
        sunset,
        is_day: current.is_day.unwrap_or(1) == 1,
        hourly,
        forecast,
    })
}

fn extract_time(datetime_str: &str) -> String {
    // "2026-03-25T14:00" → "14:00"
    datetime_str.split('T').nth(1).unwrap_or("").chars().take(5).collect()
}

fn weather_icon(code: i64) -> String {
    match code {
        0 => "☀️", 1 | 2 => "🌤️", 3 => "☁️",
        45 | 48 => "🌫️",
        51 | 53 | 55 | 56 | 57 => "🌦️",
        61 | 63 | 65 | 80 | 81 | 82 => "🌧️",
        66 | 67 | 85 | 86 => "🌨️",
        71 | 73 | 75 | 77 => "❄️",
        95 | 96 | 99 => "⛈️",
        _ => "🌤️",
    }.to_string()
}

fn weather_description(code: i64) -> String {
    match code {
        0 => "Ясно", 1 => "Преимущественно ясно", 2 => "Переменная облачность",
        3 => "Пасмурно", 45 | 48 => "Туман",
        51 => "Лёгкая морось", 53 => "Морось", 55 => "Сильная морось",
        61 => "Небольшой дождь", 63 => "Дождь", 65 => "Сильный дождь",
        66 | 67 => "Ледяной дождь",
        71 => "Небольшой снег", 73 => "Снег", 75 => "Сильный снег", 77 => "Снежная крупа",
        80 => "Небольшой ливень", 81 => "Ливень", 82 => "Сильный ливень",
        85 => "Небольшой снегопад", 86 => "Сильный снегопад",
        95 => "Гроза", 96 | 99 => "Гроза с градом",
        _ => "Переменная облачность",
    }.to_string()
}
