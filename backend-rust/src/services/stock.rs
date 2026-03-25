//! Stock price service — MOEX ISS (Russian stocks) + Yahoo Finance (US/global stocks).
//! Both are free, no API keys required.

use serde::{Deserialize, Serialize};

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
    let client = reqwest::Client::new();
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

    let resp: MoexResponse = client.get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send().await.map_err(|e| format!("MOEX: {e}"))?
        .json().await.map_err(|e| format!("MOEX parse: {e}"))?;

    let sec = resp.securities.ok_or("No securities data")?;
    let md = resp.marketdata.ok_or("No market data")?;
    let sec_row = sec.data.first().ok_or("Ticker not found on MOEX")?;
    let md_row = md.data.first().ok_or("No market data for ticker")?;

    let name = sec.get_str(sec_row, "SHORTNAME");

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
            chart: vec![],
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
            chart: vec![],
        })
    }
}

// ── Yahoo Finance (US/global stocks, no key needed) ─────────────────────

async fn fetch_yahoo(symbol: &str) -> Result<StockQuote, String> {
    let client = reqwest::Client::new();
    let upper = symbol.to_uppercase();

    // Fetch intraday (5min intervals, 1 day) for chart
    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{}?interval=5m&range=1d&includePrePost=true",
        upper
    );

    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0")
        .timeout(std::time::Duration::from_secs(8))
        .send().await
        .map_err(|e| format!("Yahoo: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Yahoo returned {}", resp.status()));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("Yahoo parse: {e}"))?;

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

pub async fn get_stock_quote(symbol: &str) -> Result<StockQuote, String> {
    if is_moex_ticker(symbol) {
        fetch_moex(symbol).await
    } else {
        fetch_yahoo(symbol).await
    }
}
