//! Stock price service — MOEX ISS (Russian stocks) + Yahoo Finance (US/global stocks).
//! Both are free, no API keys required.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

/// Shared HTTP client — reuses connections, follows redirects, holds cookies.
static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .cookie_store(true)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .expect("failed to build HTTP client")
});

#[derive(Debug, Serialize, Clone)]
pub struct StockQuote {
    pub symbol: String,
    pub name: String,
    pub price: f64,
    pub open: f64,
    pub previous_close: f64,
    pub change: f64,
    pub change_percent: f64,
    pub high: f64,
    pub low: f64,
    pub source: String,
    pub currency: String,
    pub updated: String,
    pub chart: Vec<ChartPoint>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChartPoint {
    pub time: i64,  // unix timestamp
    pub price: f64,
    pub is_regular: bool, // true = regular hours, false = extended
}

// ── MOEX ISS (Russian stocks, no key needed) ────────────────────────────

#[derive(Deserialize)]
struct MoexResponse {
    securities: Option<MoexBlock>,
    marketdata: Option<MoexBlock>,
}

#[derive(Deserialize)]
struct MoexBlock {
    columns: Vec<String>,
    data: Vec<Vec<serde_json::Value>>,
}

impl MoexBlock {
    fn col_idx(&self, name: &str) -> Option<usize> {
        self.columns.iter().position(|c| c == name)
    }
    fn get_f64(&self, row: &[serde_json::Value], col: &str) -> f64 {
        self.col_idx(col)
            .and_then(|i| row.get(i))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0)
    }
    fn get_str(&self, row: &[serde_json::Value], col: &str) -> String {
        self.col_idx(col)
            .and_then(|i| row.get(i))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string()
    }
}

fn is_moex_ticker(symbol: &str) -> bool {
    let s = symbol.to_uppercase();
    matches!(s.as_str(),
        "SBER" | "GAZP" | "LKOH" | "YNDX" | "ROSN" | "GMKN" | "NVTK" |
        "TATN" | "PLZL" | "MAGN" | "VTBR" | "MTSS" | "ALRS" | "CHMF" |
        "POLY" | "RUAL" | "PHOR" | "AFLT" | "MOEX" | "OZON" | "TCSG" |
        "VKCO" | "IRAO" | "SNGS" | "TRNFP" | "PIKK" | "IMOEX"
    )
}

async fn fetch_moex(symbol: &str) -> Result<StockQuote, String> {
    let upper = symbol.to_uppercase();

    let url = if upper == "IMOEX" {
        format!(
            "https://iss.moex.com/iss/engines/stock/markets/index/securities/{}.json?\
             iss.meta=off&iss.only=securities,marketdata&\
             securities.columns=SECID,SHORTNAME,PREVCLOSE&\
             marketdata.columns=SECID,CURRENTVALUE,OPENVALUE,LASTCHANGE,LASTCHANGEPRCNT,LOW,HIGH,UPDATETIME",
            upper
        )
    } else {
        format!(
            "https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities/{}.json?\
             iss.meta=off&iss.only=securities,marketdata&\
             securities.columns=SECID,SHORTNAME,PREVPRICE&\
             marketdata.columns=SECID,LAST,OPEN,LOW,HIGH,CHANGE,LASTTOPREVPRICE,UPDATETIME",
            upper
        )
    };

    let resp: MoexResponse = HTTP.get(&url)
        .send().await.map_err(|e| format!("MOEX: {e}"))?
        .json().await.map_err(|e| format!("MOEX parse: {e}"))?;

    let sec = resp.securities.ok_or("No securities data")?;
    let md = resp.marketdata.ok_or("No market data")?;
    let sec_row = sec.data.first().ok_or("Ticker not found on MOEX")?;
    let md_row = md.data.first().ok_or("No market data for ticker")?;

    let name = sec.get_str(sec_row, "SHORTNAME");

    // Fetch intraday candles for chart
    let chart = fetch_moex_chart(&upper).await.unwrap_or_default();

    if upper == "IMOEX" {
        let price = md.get_f64(md_row, "CURRENTVALUE");
        let change = md.get_f64(md_row, "LASTCHANGE");
        let change_pct = md.get_f64(md_row, "LASTCHANGEPRCNT");
        let prev = sec.get_f64(sec_row, "PREVCLOSE");
        Ok(StockQuote {
            symbol: upper, name, price,
            open: md.get_f64(md_row, "OPENVALUE"),
            previous_close: if prev > 0.0 { prev } else { price - change },
            change, change_percent: change_pct,
            high: md.get_f64(md_row, "HIGH"), low: md.get_f64(md_row, "LOW"),
            source: "moex".into(), currency: "pts".into(),
            updated: md.get_str(md_row, "UPDATETIME"),
            chart,
        })
    } else {
        let price = md.get_f64(md_row, "LAST");
        Ok(StockQuote {
            symbol: upper, name, price,
            open: md.get_f64(md_row, "OPEN"),
            previous_close: sec.get_f64(sec_row, "PREVPRICE"),
            change: md.get_f64(md_row, "CHANGE"),
            change_percent: md.get_f64(md_row, "LASTTOPREVPRICE"),
            high: md.get_f64(md_row, "HIGH"), low: md.get_f64(md_row, "LOW"),
            source: "moex".into(), currency: "RUB".into(),
            updated: md.get_str(md_row, "UPDATETIME"),
            chart,
        })
    }
}

/// Fetch MOEX intraday candle data for chart rendering.
async fn fetch_moex_chart(symbol: &str) -> Result<Vec<ChartPoint>, String> {
    let (engine, market) = if symbol == "IMOEX" {
        ("stock", "index")
    } else {
        ("stock", "shares")
    };
    let board = if symbol == "IMOEX" { "SNDX" } else { "TQBR" };
    let today = chrono::Utc::now().format("%Y-%m-%d");

    let url = format!(
        "https://iss.moex.com/iss/engines/{engine}/markets/{market}/boards/{board}/securities/{symbol}/candles.json?\
         from={today}&interval=10&iss.meta=off&candles.columns=begin,close",
    );

    let data: serde_json::Value = HTTP.get(&url)
        .send().await.map_err(|e| format!("MOEX chart: {e}"))?
        .json().await.map_err(|e| format!("MOEX chart parse: {e}"))?;

    let rows = data["candles"]["data"].as_array().ok_or("No candle data")?;
    let mut points = Vec::with_capacity(rows.len());
    for row in rows {
        let time_str = row[0].as_str().unwrap_or("");
        let price = row[1].as_f64().unwrap_or(0.0);
        if price <= 0.0 { continue; }
        // Parse "2025-04-03 10:10:00" → unix timestamp
        let ts = chrono::NaiveDateTime::parse_from_str(time_str, "%Y-%m-%d %H:%M:%S")
            .map(|dt| dt.and_utc().timestamp())
            .unwrap_or(0);
        if ts > 0 {
            points.push(ChartPoint { time: ts, price, is_regular: true });
        }
    }
    Ok(points)
}

// ── Yahoo Finance (US/global stocks, no key needed) ─────────────────────

async fn fetch_yahoo(symbol: &str, range: Option<&str>) -> Result<StockQuote, String> {
    let upper = symbol.to_uppercase();

    let (api_range, api_interval) = match range.unwrap_or("1d") {
        "5d" => ("5d", "30m"),
        "1mo" => ("1mo", "1d"),
        "1y" => ("1y", "1wk"),
        _ => ("1d", "5m"),  // default
    };

    // Try query2 first (more permissive with datacenter IPs), fall back to query1
    let hosts = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
    let mut last_err = String::new();
    let mut data: serde_json::Value = serde_json::Value::Null;

    for host in &hosts {
        let url = format!(
            "https://{}/v8/finance/chart/{}?interval={}&range={}&includePrePost=true",
            host, upper, api_interval, api_range
        );

        match HTTP.get(&url).send().await {
            Ok(resp) => {
                if !resp.status().is_success() {
                    last_err = format!("Yahoo {} returned {}", host, resp.status());
                    continue;
                }
                match resp.json::<serde_json::Value>().await {
                    Ok(d) => { data = d; break; }
                    Err(e) => { last_err = format!("Yahoo parse: {e}"); continue; }
                }
            }
            Err(e) => { last_err = format!("Yahoo {}: {e}", host); continue; }
        }
    }

    if data.is_null() {
        return Err(last_err);
    }

    let result = &data["chart"]["result"][0];
    let meta = &result["meta"];

    let price = meta["regularMarketPrice"].as_f64()
        .ok_or("No price data")?;
    let prev_close = meta["chartPreviousClose"].as_f64()
        .or_else(|| meta["previousClose"].as_f64())
        .unwrap_or(price);
    let change = price - prev_close;
    let change_pct = if prev_close != 0.0 { (change / prev_close) * 100.0 } else { 0.0 };

    let name = meta["shortName"].as_str()
        .or_else(|| meta["symbol"].as_str())
        .unwrap_or(&upper)
        .to_string();

    let currency = meta["currency"].as_str().unwrap_or("USD").to_string();

    // Regular market hours from meta
    let reg_start = meta["currentTradingPeriod"]["regular"]["start"].as_i64().unwrap_or(0);
    let reg_end = meta["currentTradingPeriod"]["regular"]["end"].as_i64().unwrap_or(0);

    // Extract chart data from timestamps + close prices
    let timestamps = result["timestamp"].as_array();
    let closes = result["indicators"]["quote"][0]["close"].as_array();

    let mut chart = Vec::new();
    if let (Some(ts), Some(cl)) = (timestamps, closes) {
        for (i, t) in ts.iter().enumerate() {
            let time = t.as_i64().unwrap_or(0);
            let p = cl.get(i).and_then(|v| v.as_f64());
            if let Some(p) = p {
                chart.push(ChartPoint {
                    time,
                    price: (p * 100.0).round() / 100.0,
                    is_regular: time >= reg_start && time <= reg_end,
                });
            }
        }
    }

    // Get OHLC from indicators (last period)
    let quotes = &result["indicators"]["quote"][0];
    let open = quotes["open"].as_array()
        .and_then(|a| a.iter().find_map(|v| v.as_f64()))
        .unwrap_or(price);
    let high = quotes["high"].as_array()
        .and_then(|a| a.iter().filter_map(|v| v.as_f64()).reduce(f64::max))
        .unwrap_or(price);
    let low = quotes["low"].as_array()
        .and_then(|a| a.iter().filter_map(|v| v.as_f64()).reduce(f64::min))
        .unwrap_or(price);

    Ok(StockQuote {
        symbol: upper, name, price, open, previous_close: prev_close,
        change, change_percent: (change_pct * 100.0).round() / 100.0,
        high, low,
        source: "yahoo".into(), currency,
        updated: chrono::Utc::now().format("%H:%M").to_string(),
        chart,
    })
}

// ── Public API ──────────────────────────────────────────────────────────

pub async fn get_stock_quote(symbol: &str, range: Option<&str>) -> Result<StockQuote, String> {
    if is_moex_ticker(symbol) {
        fetch_moex(symbol).await
    } else {
        fetch_yahoo(symbol, range).await
    }
}
