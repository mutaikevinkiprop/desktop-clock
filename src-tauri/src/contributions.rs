//! GitHub contribution data for the live wallpaper.
//!
//! The wallpaper renders a GitHub-style contribution heatmap ("the green
//! squares") and animates a light sweeping across it. This module fetches a
//! user's real contribution counts and normalises them into a compact grid
//! the frontend can draw.
//!
//! We use the public `github-contributions-api.jogruber.de` JSON endpoint,
//! which returns one clean record per day (`date`, `count`, `level`) with no
//! authentication required. Scraping GitHub's own HTML is fragile (the cell
//! ids, tooltips and dates are correlated in ways that change without notice),
//! so JSON is the reliable source. The data ultimately originates from the
//! same public contribution graph GitHub shows on every profile.
//!
//! If the network is unavailable (or no username is configured) the frontend
//! falls back to a locally-generated pattern, so the wallpaper always works.

use serde::{Deserialize, Serialize};

/// A single day in the contribution grid.
#[derive(Debug, Clone, Serialize)]
pub struct ContributionDay {
    /// ISO date, e.g. "2026-01-31".
    pub date: String,
    /// Number of contributions that day.
    pub count: u32,
    /// GitHub's own intensity level 0..4 (0 = none).
    pub level: u8,
}

/// A normalised contribution grid handed to the wallpaper page.
#[derive(Debug, Clone, Serialize)]
pub struct ContributionGraph {
    pub username: String,
    /// Total contributions across the (trailing year) window.
    pub total: u32,
    /// Longest streak of consecutive contributing days in the window.
    pub longest_streak: u32,
    /// Current streak (consecutive contributing days ending on the last day).
    pub current_streak: u32,
    /// Days, oldest first, one entry per calendar day.
    pub days: Vec<ContributionDay>,
}

/// One record from the upstream JSON API.
#[derive(Debug, Deserialize)]
struct ApiDay {
    date: String,
    count: u32,
    level: u8,
}

/// The API response envelope.
#[derive(Debug, Deserialize)]
struct ApiResponse {
    contributions: Vec<ApiDay>,
}

/// Number of days to keep for the grid (GitHub shows ~53 weeks = 371 days).
const WINDOW_DAYS: usize = 371;

/// Normalise an API response into our `ContributionGraph`: keep the trailing
/// `WINDOW_DAYS` days, sort oldest-first, and compute real totals/streaks.
fn normalise(username: &str, resp: ApiResponse) -> ContributionGraph {
    // The API lists newest-first; sort oldest-first so the grid reads left->right.
    let mut all = resp.contributions;
    all.sort_by(|a, b| a.date.cmp(&b.date));

    // Keep the trailing window (the current contribution year).
    let start = all.len().saturating_sub(WINDOW_DAYS);
    let days: Vec<ContributionDay> = all[start..]
        .iter()
        .map(|d| ContributionDay {
            date: d.date.clone(),
            count: d.count,
            level: d.level.min(4),
        })
        .collect();

    let total: u32 = days.iter().map(|d| d.count).sum();
    let longest_streak = longest_streak(&days);
    let current_streak = current_streak(&days);

    ContributionGraph {
        username: username.to_string(),
        total,
        longest_streak,
        current_streak,
        days,
    }
}

/// Longest run of consecutive days with at least one contribution.
fn longest_streak(days: &[ContributionDay]) -> u32 {
    let mut best = 0u32;
    let mut run = 0u32;
    for d in days {
        if d.count > 0 {
            run += 1;
            best = best.max(run);
        } else {
            run = 0;
        }
    }
    best
}

/// Current streak: consecutive contributing days ending on the last day.
fn current_streak(days: &[ContributionDay]) -> u32 {
    let mut run = 0u32;
    for d in days.iter().rev() {
        if d.count > 0 {
            run += 1;
        } else {
            break;
        }
    }
    run
}

/// Fetch a user's contribution graph. Blocking; call from a background thread.
/// Returns an error string suitable for the frontend.
pub fn fetch(username: &str) -> Result<ContributionGraph, String> {
    let username = username.trim();
    if username.is_empty() {
        return Err("no username configured".into());
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("invalid username".into());
    }

    let url = format!("https://github-contributions-api.jogruber.de/v4/{username}?y=last");
    let resp = ureq::get(&url)
        .set(
            "User-Agent",
            "DesktopClock-Wallpaper/1.0 (+https://github.com)",
        )
        .set("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(20))
        .call()
        .map_err(|e| format!("request failed: {e}"))?;

    let parsed: ApiResponse = resp.into_json().map_err(|e| format!("invalid JSON: {e}"))?;

    if parsed.contributions.is_empty() {
        return Err("no contribution data found (private or missing profile)".into());
    }

    Ok(normalise(username, parsed))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalises_sorts_and_computes_streaks() {
        let resp = ApiResponse {
            contributions: vec![
                ApiDay {
                    date: "2025-01-03".into(),
                    count: 0,
                    level: 0,
                },
                ApiDay {
                    date: "2025-01-01".into(),
                    count: 2,
                    level: 1,
                },
                ApiDay {
                    date: "2025-01-02".into(),
                    count: 5,
                    level: 2,
                },
            ],
        };
        let g = normalise("someone", resp);
        assert_eq!(g.days.len(), 3);
        assert_eq!(g.days[0].date, "2025-01-01"); // oldest first
        assert_eq!(g.days[2].date, "2025-01-03");
        assert_eq!(g.total, 7);
        assert_eq!(g.longest_streak, 2);
        // current streak ends on a zero day -> 0
        assert_eq!(g.current_streak, 0);
    }

    #[test]
    fn current_streak_counts_trailing_days() {
        let resp = ApiResponse {
            contributions: vec![
                ApiDay {
                    date: "2025-01-01".into(),
                    count: 0,
                    level: 0,
                },
                ApiDay {
                    date: "2025-01-02".into(),
                    count: 1,
                    level: 1,
                },
                ApiDay {
                    date: "2025-01-03".into(),
                    count: 4,
                    level: 2,
                },
            ],
        };
        let g = normalise("someone", resp);
        assert_eq!(g.current_streak, 2);
        assert_eq!(g.longest_streak, 2);
    }
}
