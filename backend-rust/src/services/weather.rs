//! Weather service using Open-Meteo (free, no API key, global coverage).

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Clone)]
pub struct WeatherResponse {
    pub city: String,
    pub temperature: f64,
    pub feels_like: f64,
    pub description: String,
    pub icon: String,
    pub wind_speed: f64,
    pub humidity: Option<f64>,
    pub forecast: Vec<ForecastDay>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ForecastDay {
    pub day: String,
    pub temp_max: f64,
    pub temp_min: f64,
    pub icon: String,
    pub code: i64,
}

#[derive(Debug, Deserialize)]
struct GeoResult {
    results: Option<Vec<GeoEntry>>,
}

#[derive(Debug, Deserialize)]
struct GeoEntry {
    latitude: f64,
    longitude: f64,
    name: String,
    country: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MeteoResponse {
    current_weather: Option<CurrentWeather>,
    daily: Option<DailyData>,
}

#[derive(Debug, Deserialize)]
struct CurrentWeather {
    temperature: f64,
    windspeed: f64,
    weathercode: i64,
}

#[derive(Debug, Deserialize)]
struct DailyData {
    time: Vec<String>,
    temperature_2m_max: Vec<f64>,
    temperature_2m_min: Vec<f64>,
    weathercode: Vec<i64>,
    apparent_temperature_max: Option<Vec<f64>>,
    relative_humidity_2m_max: Option<Vec<f64>>,
}

/// Fetch weather for a city name.
pub async fn get_weather(city: &str) -> Result<WeatherResponse, String> {
    let client = reqwest::Client::new();

    // 1. Geocode city name → coordinates
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=ru",
        urlencoding::encode(city)
    );
    let geo: GeoResult = client
        .get(&geo_url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Geocoding failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Geocoding parse: {e}"))?;

    let entry = geo.results
        .and_then(|r| r.into_iter().next())
        .ok_or_else(|| format!("City not found: {city}"))?;

    // 2. Fetch weather
    let weather_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode,apparent_temperature_max,relative_humidity_2m_max&timezone=auto&forecast_days=5",
        entry.latitude, entry.longitude
    );
    let meteo: MeteoResponse = client
        .get(&weather_url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Weather fetch failed: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Weather parse: {e}"))?;

    let current = meteo.current_weather.ok_or("No current weather data")?;
    let daily = meteo.daily.ok_or("No daily data")?;

    let feels_like = daily.apparent_temperature_max
        .as_ref()
        .and_then(|v| v.first().copied())
        .unwrap_or(current.temperature);
    let humidity = daily.relative_humidity_2m_max
        .as_ref()
        .and_then(|v| v.first().copied());

    let city_display = if let Some(country) = &entry.country {
        format!("{}, {}", entry.name, country)
    } else {
        entry.name.clone()
    };

    // Build forecast
    let weekdays_ru = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    let forecast: Vec<ForecastDay> = daily.time.iter().enumerate().map(|(i, date_str)| {
        let day_name = if i == 0 {
            "Сегодня".to_string()
        } else if i == 1 {
            "Завтра".to_string()
        } else {
            // Parse date to get weekday
            chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
                .map(|d| {
                    use chrono::Datelike;
                    weekdays_ru[d.weekday().num_days_from_sunday() as usize].to_string()
                })
                .unwrap_or_else(|_| date_str.clone())
        };
        let code = daily.weathercode.get(i).copied().unwrap_or(0);
        ForecastDay {
            day: day_name,
            temp_max: daily.temperature_2m_max.get(i).copied().unwrap_or(0.0),
            temp_min: daily.temperature_2m_min.get(i).copied().unwrap_or(0.0),
            icon: weather_icon(code),
            code,
        }
    }).collect();

    Ok(WeatherResponse {
        city: city_display,
        temperature: current.temperature,
        feels_like,
        description: weather_description(current.weathercode),
        icon: weather_icon(current.weathercode),
        wind_speed: current.windspeed,
        humidity,
        forecast,
    })
}

fn weather_icon(code: i64) -> String {
    match code {
        0 => "☀️",
        1 | 2 => "🌤️",
        3 => "☁️",
        45 | 48 => "🌫️",
        51 | 53 | 55 => "🌦️",
        56 | 57 => "🌧️",
        61 | 63 | 65 => "🌧️",
        66 | 67 => "🌨️",
        71 | 73 | 75 => "❄️",
        77 => "🌨️",
        80 | 81 | 82 => "🌧️",
        85 | 86 => "🌨️",
        95 => "⛈️",
        96 | 99 => "⛈️",
        _ => "🌤️",
    }.to_string()
}

fn weather_description(code: i64) -> String {
    match code {
        0 => "Ясно",
        1 => "Преимущественно ясно",
        2 => "Переменная облачность",
        3 => "Пасмурно",
        45 | 48 => "Туман",
        51 => "Лёгкая морось",
        53 => "Морось",
        55 => "Сильная морось",
        61 => "Небольшой дождь",
        63 => "Дождь",
        65 => "Сильный дождь",
        66 | 67 => "Ледяной дождь",
        71 => "Небольшой снег",
        73 => "Снег",
        75 => "Сильный снег",
        77 => "Снежная крупа",
        80 => "Небольшой ливень",
        81 => "Ливень",
        82 => "Сильный ливень",
        85 => "Небольшой снегопад",
        86 => "Сильный снегопад",
        95 => "Гроза",
        96 | 99 => "Гроза с градом",
        _ => "Переменная облачность",
    }.to_string()
}
