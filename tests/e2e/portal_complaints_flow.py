"""
E2E: signed-in patient uses /portal/complaints to create a complaint,
open its details, and see the status update live via Realtime.

Assertions:

  1. Signed-in patient sees the empty state on first visit.
  2. Submitting the "بلاغ جديد" form:
       - Shows a success toast with the reference number (CMP-XXXXXXXX).
       - Creates exactly ONE complaints row for this patient_user_id with
         message/type/department/status='submitted'.
       - Row appears in the list within the page.
  3. Opening the detail modal:
       - Renders the reference, the message text, and the "تم الإرسال" badge.
       - Shows the "تعديل" edit button (allowed while status='submitted').
  4. Realtime: when the row's status is changed to 'under_review' via the
     service role API (simulating staff action), the UI updates without a
     manual refresh:
       - Detail modal badge switches to "تحت المراجعة".
       - The "تعديل" edit button disappears (edit is locked after review).
  5. Realtime again: switching to 'resolved' updates the badge to "تم الحل".

Env: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
Run: python3 tests/e2e/portal_complaints_flow.py
"""
import asyncio, os, sys, time, json, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright

SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

URL = os.environ["SUPABASE_URL"]
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def sb(path, method="POST", body=None):
    req = urllib.request.Request(
        f"{URL}{path}", method=method,
        headers={"apikey": SVC, "Authorization": f"Bearer {SVC}",
                 "Content-Type": "application/json",
                 "Prefer": "return=representation"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def create_patient(email):
    pwd = f"Test!{int(time.time() * 1000)}Aa1"
    u = sb("/auth/v1/admin/users",
           body={"email": email, "password": pwd, "email_confirm": True})
    # Ensure a profiles row exists so getMyProfile / RLS behave normally.
    try:
        sb("/rest/v1/profiles",
           body={"id": u["id"], "full_name": "بلاغات E2E", "phone": "0500000000"})
    except Exception:
        pass
    return u["id"], email, pwd


def delete_user(uid):
    try:
        sb(f"/auth/v1/admin/users/{uid}", method="DELETE")
    except Exception:
        pass


async def sign_in_and_open_portal(page, email, pwd):
    await page.goto(
        "http://localhost:8080/auth?redirect=%2Fportal%2Fcomplaints",
        wait_until="networkidle",
    )
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', pwd)
    await page.click('button[type="submit"]')
    await page.wait_for_url("**/portal/complaints", timeout=15000)
    await page.wait_for_timeout(600)


async def submit_new_complaint(page, message, department):
    await page.get_by_role("button", name="بلاغ جديد").first.click()
    dialog = page.locator("div.max-w-2xl").last
    await dialog.wait_for(timeout=6000)
    # Name/phone are prefilled from profile; only edit message + department.
    await dialog.locator('input[placeholder*="الاستقبال"]').fill(department)
    await dialog.locator("textarea").fill(message)
    await dialog.get_by_role("button", name="إرسال البلاغ").click()
    # Wait for the toast with the reference number.
    await page.get_by_text("تم إرسال البلاغ", exact=False).first.wait_for(timeout=10000)
    await page.screenshot(path=str(SHOTS / "portal_complaints_submitted.png"))


async def open_detail(page, message_fragment):
    row = page.locator("button", has_text=message_fragment).first
    await row.wait_for(timeout=8000)
    await row.click()
    await page.locator("div.max-w-2xl").last.wait_for(timeout=6000)
    await page.screenshot(path=str(SHOTS / "portal_complaints_detail.png"))


async def modal_status_text(page):
    modal = page.locator("div.max-w-2xl").last
    # The status badge lives at the top of the modal; grab all its text.
    return (await modal.inner_text()).strip()


async def wait_for_modal_text(page, needle, timeout_ms=8000):
    modal = page.locator("div.max-w-2xl").last
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        try:
            txt = await modal.inner_text()
            if needle in txt:
                return True
        except Exception:
            pass
        await page.wait_for_timeout(300)
    return False


async def main():
    stamp = int(time.time())
    email = f"e2e-portal-complaints-{stamp}@test.local"
    message = f"بلاغ اختباري رقم {stamp} — تجربة تدفق البوابة"
    department = "الاستقبال"
    uid, email, pwd = create_patient(email)
    failures = []
    complaint_id = None
    reference = None

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
            page = await ctx.new_page()
            try:
                await sign_in_and_open_portal(page, email, pwd)

                # 1. Empty state present.
                empty = await page.get_by_text("لا توجد بلاغات بعد").count()
                if empty == 0:
                    failures.append("empty state 'لا توجد بلاغات بعد' not shown on first visit")

                # 2. Submit form.
                await submit_new_complaint(page, message, department)

                # 3. DB assertions.
                rows = sb(
                    f"/rest/v1/complaints?patient_user_id=eq.{uid}"
                    "&select=id,reference,message,department,type,status,attachments",
                    method="GET") or []
                if len(rows) != 1:
                    failures.append(
                        f"expected 1 complaints row for user, got {len(rows)}")
                else:
                    r = rows[0]
                    complaint_id = r["id"]
                    reference = r["reference"]
                    if r["status"] != "submitted":
                        failures.append(f"status={r['status']!r}, expected 'submitted'")
                    if r["message"] != message:
                        failures.append(f"message mismatch: {r['message']!r}")
                    if r["department"] != department:
                        failures.append(f"department={r['department']!r}, expected {department!r}")
                    if r["type"] != "complaint":
                        failures.append(f"type={r['type']!r}, expected 'complaint'")
                    if not (reference or "").startswith("CMP-"):
                        failures.append(f"reference {reference!r} missing CMP- prefix")

                # 4. Row visible in list.
                await page.wait_for_timeout(400)
                visible = await page.get_by_text(message[:20], exact=False).count()
                if visible == 0:
                    failures.append("submitted complaint not visible in the list")

                # 5. Detail modal + edit button while submitted.
                if complaint_id and not failures:
                    await open_detail(page, message[:20])
                    txt = await modal_status_text(page)
                    if "تم الإرسال" not in txt:
                        failures.append(
                            f"detail modal missing 'تم الإرسال' badge; got: {txt[:200]!r}")
                    if reference and reference not in txt:
                        failures.append(
                            f"detail modal missing reference {reference!r}")
                    edit_btn = page.locator("div.max-w-2xl").last.get_by_role(
                        "button", name="تعديل")
                    if await edit_btn.count() == 0:
                        failures.append(
                            "'تعديل' button missing while status='submitted'")

                    # 6. Realtime: flip status to under_review via service role.
                    sb(f"/rest/v1/complaints?id=eq.{complaint_id}",
                       method="PATCH",
                       body={"status": "under_review"})
                    ok = await wait_for_modal_text(page, "تحت المراجعة", 10000)
                    if not ok:
                        await page.screenshot(
                            path=str(SHOTS / "portal_complaints_no_realtime.png"))
                        failures.append(
                            "Realtime did not update modal to 'تحت المراجعة'")
                    edit_btn2 = page.locator("div.max-w-2xl").last.get_by_role(
                        "button", name="تعديل")
                    # Wait briefly for re-render after realtime patch.
                    await page.wait_for_timeout(500)
                    if await edit_btn2.count() != 0:
                        failures.append(
                            "'تعديل' button must disappear after review starts")

                    # 7. Realtime: flip to resolved.
                    sb(f"/rest/v1/complaints?id=eq.{complaint_id}",
                       method="PATCH",
                       body={"status": "resolved"})
                    ok2 = await wait_for_modal_text(page, "تم الحل", 10000)
                    if not ok2:
                        await page.screenshot(
                            path=str(SHOTS / "portal_complaints_no_resolve.png"))
                        failures.append(
                            "Realtime did not update modal to 'تم الحل'")
            finally:
                await browser.close()
    finally:
        if complaint_id:
            try:
                sb(f"/rest/v1/complaints?id=eq.{complaint_id}", method="DELETE")
            except Exception:
                pass
        try:
            sb(f"/rest/v1/profiles?id=eq.{uid}", method="DELETE")
        except Exception:
            pass
        delete_user(uid)

    if failures:
        print("❌ FAIL")
        for f in failures:
            print(" -", f)
        sys.exit(1)
    print("✅ portal_complaints_flow e2e passed "
          "(empty state → submit → row in DB + list → detail modal → "
          "Realtime badge updates for under_review and resolved)")


asyncio.run(main())
