"""
Playwright test for the Instructor Dashboard.
Tests that the dashboard loads correctly and displays all expected sections.
"""

import requests
from playwright.sync_api import sync_playwright, expect

SERVER_URL = "http://localhost:3000"
CLIENT_URL = "http://localhost:3001"


def create_run(class_code: str) -> dict:
    """Create a new run via the API and return the run info."""
    response = requests.post(
        f"{SERVER_URL}/api/run/create",
        json={"classCode": class_code},
        timeout=10
    )
    response.raise_for_status()
    return response.json()


def test_dashboard():
    """Test the instructor dashboard displays correctly."""

    # Create a run to get dashboard URL
    print("Creating a new run...")
    run_info = create_run("TEST101")
    run_id = run_info["runId"]
    token = run_info["dashboardUrl"].split("token=")[1]

    print(f"Run created: {run_id}")
    print(f"Dashboard URL: {run_info['dashboardUrl']}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the dashboard
        dashboard_url = f"{CLIENT_URL}/dashboard/{run_id}?token={token}"
        print(f"Navigating to: {dashboard_url}")
        page.goto(dashboard_url)

        # Wait for the page to load
        page.wait_for_load_state("networkidle")

        # Take initial screenshot
        page.screenshot(path="/tmp/dashboard_initial.png", full_page=True)
        print("Screenshot saved: /tmp/dashboard_initial.png")

        # Verify the dashboard header is present
        header = page.locator(".dashboard-header h1")
        expect(header).to_have_text("Instructor Dashboard")
        print("Dashboard header verified")

        # Verify status cards are present
        status_cards = page.locator(".status-card")
        expect(status_cards).to_have_count(6)
        print("Status cards verified (6 cards)")

        # Verify status card labels
        expect(page.locator("text=Connected")).to_be_visible()
        expect(page.locator("text=In Queue")).to_be_visible()
        expect(page.locator("text=Active Games")).to_be_visible()
        expect(page.locator("text=Completed")).to_be_visible()
        expect(page.locator("text=Abandoned")).to_be_visible()
        expect(page.locator("text=Auto-Moves")).to_be_visible()
        print("All status card labels verified")

        # Verify rounds section
        rounds_section = page.locator(".rounds-section")
        expect(rounds_section).to_be_visible()
        expect(page.locator("text=Contribute vs Protect by Round")).to_be_visible()
        print("Rounds section verified")

        # Verify all 8 round cards are present
        round_cards = page.locator(".round-card")
        expect(round_cards).to_have_count(8)
        print("All 8 round cards verified")

        # Verify bonus round badges
        expect(page.locator(".bonus-3x")).to_be_visible()  # Round 4
        expect(page.locator(".bonus-10x")).to_be_visible()  # Round 8
        print("Bonus round badges verified (3x and 10x)")

        # Verify patterns section
        expect(page.locator("text=Outcome Patterns")).to_be_visible()
        expect(page.locator("text=4 Contribute")).to_be_visible()
        expect(page.locator("text=4 Protect")).to_be_visible()
        print("Patterns section verified")

        # Verify scores section
        expect(page.locator("text=Group Score Comparison")).to_be_visible()
        expect(page.locator("text=All-Contribute Benchmark")).to_be_visible()
        expect(page.locator("text=76")).to_be_visible()  # Benchmark value
        print("Scores section verified")

        # Take final screenshot
        page.screenshot(path="/tmp/dashboard_final.png", full_page=True)
        print("Final screenshot saved: /tmp/dashboard_final.png")

        browser.close()

    print("\nAll dashboard tests passed!")


if __name__ == "__main__":
    test_dashboard()
