//! Web search via local SearXNG instance.

use serde::{Deserialize, Serialize};

use crate::config::Config;

/// A single search result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub title: String,
    pub url: String,
    pub content: String, // snippet
    pub domain: String,
}

/// Search response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResult>,
}

#[derive(Debug, Deserialize)]
struct SearxResult {
    title: Option<String>,
    url: Option<String>,
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearxResponse {
    results: Vec<SearxResult>,
}

/// Execute a web search query via the local SearXNG instance.
/// Returns up to `max_results` results.
pub async fn web_search(
    query: &str,
    max_results: usize,
    config: &Config,
) -> Result<SearchResponse, String> {
    let searx_url = format!(
        "{}/search?q={}&format=json&language=ru&safesearch=1",
        config.searxng_url,
        urlencoding::encode(query),
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let resp = client
        .get(&searx_url)
        .send()
        .await
        .map_err(|e| format!("SearXNG request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("SearXNG returned status {}", resp.status()));
    }

    let data: SearxResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse SearXNG response: {e}"))?;

    let results: Vec<SearchResult> = data
        .results
        .into_iter()
        .take(max_results)
        .filter_map(|r| {
            let url = r.url?;
            let title = r.title.unwrap_or_default();
            if title.is_empty() {
                return None;
            }
            let domain = url::Url::parse(&url)
                .ok()
                .and_then(|u| u.host_str().map(|h| h.to_string()))
                .unwrap_or_default();
            Some(SearchResult {
                title,
                url,
                content: r.content.unwrap_or_default(),
                domain,
            })
        })
        .collect();

    Ok(SearchResponse {
        query: query.to_string(),
        results,
    })
}
