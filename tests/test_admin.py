"""
Playwright test for the Admin Page.
Tests that instructors can create sessions easily.
"""

from playwright.sync_api import sync_playwright, expect

CLIENT_URL = "http://localhost:3001"


def test_admin_page():
    """Test the admin page for creating sessions."""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to admin page
        print("Navigating to admin page...")
        page.goto(f"{CLIENT_URL}/admin")
        page.wait_for_load_state("networkidle")

        # Take screenshot
        page.screenshot(path="/tmp/admin_initial.png", full_page=True)
        print("Screenshot saved: /tmp/admin_initial.png")

        # Verify admin page elements
        expect(page.locator("h1")).to_have_text("Instructor Setup")
        expect(page.locator("text=Create a new session")).to_be_visible()
        expect(page.locator("input#classCode")).to_be_visible()
        expect(page.locator("button:has-text('Create Session')")).to_be_visible()
        print("Admin page elements verified")

        # Enter a class code
        print("Entering class code TEST101...")
        page.fill("input#classCode", "test101")

        # Verify input is uppercase
        expect(page.locator("input#classCode")).to_have_value("TEST101")
        print("Class code auto-uppercased")

        # Click create session
        print("Creating session...")
        page.click("button:has-text('Create Session')")

        # Wait for session to be created
        page.wait_for_selector(".success-badge", timeout=10000)
        print("Session created successfully")

        # Take screenshot of created session
        page.screenshot(path="/tmp/admin_created.png", full_page=True)
        print("Screenshot saved: /tmp/admin_created.png")

        # Verify session info is displayed
        expect(page.locator(".success-badge")).to_have_text("Session Created")
        expect(page.locator(".big-code")).to_have_text("TEST101")
        expect(page.locator("text=Student URL")).to_be_visible()
        expect(page.locator("text=Instructor Dashboard")).to_be_visible()
        expect(page.locator("a:has-text('Open Dashboard')")).to_be_visible()
        print("Session info verified")

        # Test copy buttons exist
        copy_buttons = page.locator(".copy-btn")
        expect(copy_buttons).to_have_count(3)  # code, student URL, dashboard URL
        print("Copy buttons verified")

        # Test "Create Another Session" button
        expect(page.locator("button:has-text('Create Another Session')")).to_be_visible()
        print("Reset button verified")

        browser.close()

    print("\nAll admin page tests passed!")


if __name__ == "__main__":
    test_admin_page()
