"""
E2E: تدفق الحجز العام /api/public/book/* — الحالات الحدّية (400/409/200).

يمنع أي تراجع مستقبلي في:
  • GET /api/public/book/availability
  • POST /api/public/book/create
  • POST /api/public/book/cancel
  • POST /api/public/book/track

الاختبار مستقل بذاته:
  1. يقرأ من `availability` طبيبًا مع يوم عمل + وقت متاح، ويختار أقرب تاريخ
     مستقبلي يوافق weekday الطبيب.
  2. ينفّذ 15 سيناريو (تحقق مدخلات، تكرار الحجز، إلغاء بمعرّف/هاتف خاطئ،
     إلغاء صحيح، إعادة استخدام نفس الوقت بعد الإلغاء…) ويؤكّد الحالة
     ورسائل الخطأ العربية.
  3. ينظّف كل الحجوزات التي أنشأها عبر service role.

Env:
  E2E_BASE_URL              — الافتراضي http://localhost:8080
  SUPABASE_URL              — للاستعلام والتنظيف
  SUPABASE_SERVICE_ROLE_KEY — لقراءة availability وحذف الحجوزات

التشغيل:
  python3 tests/e2e/book_public_api_edge_cases.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta

BASE = os.environ.get("E2E_BASE_URL", "http://localhost:8080").rstrip("/")
SB_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SB_URL or not SB_KEY:
    print("!! SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبان للتنظيف", file=sys.stderr)
    sys.exit(2)


# ------------------------------------------------------------------ helpers --
def _req(method: str, url: str, *, body=None, headers=None):
    data = None
    hdrs = {"Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            hdrs.setdefault("Content-Type", "application/json")
        else:
            data = body.encode("utf-8") if isinstance(body, str) else body
    req = urllib.request.Request(url, method=method, data=data, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def api(method: str, path: str, *, body=None, query=None):
    q = f"?{urllib.parse.urlencode(query)}" if query else ""
    status, raw = _req(method, f"{BASE}{path}{q}", body=body)
    try:
        return status, json.loads(raw) if raw else None
    except json.JSONDecodeError:
        return status, {"_raw": raw[:300]}


def sb(method: str, path: str, *, body=None):
    return _req(
        method,
        f"{SB_URL}{path}",
        body=body,
        headers={
            "apikey": SB_KEY,
            "Authorization": f"Bearer {SB_KEY}",
            "Prefer": "return=representation",
        },
    )


# ------------------------------------------------------------------ setup ----
def pick_bookable_slot():
    """Return (doctor_id, iso_date, hhmm) that /availability will surface."""
    status, raw = sb(
        "GET",
        "/rest/v1/availability?select=doctor_id,weekday,start_time,end_time,slot_minutes"
        "&limit=50",
    )
    if status != 200:
        raise SystemExit(f"availability read failed: {status} {raw[:200]}")
    rows = json.loads(raw)
    if not rows:
        raise SystemExit("no availability rows to seed the test")

    # sqlite-like weekday: Postgres EXTRACT(dow) = Sun 0..Sat 6.
    py_to_pg = {6: 0, 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6}  # python weekday → pg dow
    today = date.today()
    for offset in range(1, 30):  # avoid "today past-slot" edge case
        d = today + timedelta(days=offset)
        pg_dow = py_to_pg[d.weekday()]
        for row in rows:
            if int(row["weekday"]) != pg_dow:
                continue
            # pick a time comfortably inside the window (start + slot)
            start = row["start_time"][:5]
            hh, mm = map(int, start.split(":"))
            slot = int(row["slot_minutes"] or 30)
            total = hh * 60 + mm + slot  # 2nd slot to dodge collisions
            hhmm = f"{total // 60:02d}:{total % 60:02d}"
            return row["doctor_id"], d.isoformat(), hhmm
    raise SystemExit("no future weekday matched availability rows")


def cleanup(phone: str):
    sb("DELETE", f"/rest/v1/appointments?patient_phone=eq.{urllib.parse.quote(phone)}")


# ------------------------------------------------------------------ runner ---
FAILED: list[str] = []


def check(label: str, ok: bool, detail: str = ""):
    mark = "✅" if ok else "❌"
    print(f"  {mark} {label}" + (f"  — {detail}" if detail else ""))
    if not ok:
        FAILED.append(label)


def expect_status(label, got, want, body):
    check(
        label,
        got == want,
        f"got {got} want {want}" + (f" body={json.dumps(body, ensure_ascii=False)[:180]}" if got != want else ""),
    )


def expect_msg_contains(label, body, needle):
    msg = (body or {}).get("message", "") if isinstance(body, dict) else ""
    check(label, needle in msg, f"needle={needle!r} msg={msg!r}")


# ------------------------------------------------------------------ scenarios
def run():
    doctor_id, iso_date, hhmm = pick_bookable_slot()
    phone = f"055{int(time.time()) % 10_000_000:07d}"
    print(f"→ doctor={doctor_id} date={iso_date} time={hhmm} phone={phone}\n")

    # Pre-clean in case a previous run left rows behind.
    cleanup(phone)

    # ── GET /availability ────────────────────────────────────────────────
    print("== availability ==")
    st, body = api("GET", "/api/public/book/availability",
                   query={"date": iso_date, "doctor_id": doctor_id})
    expect_status("G1 valid params → 200", st, 200, body)
    times = (body or {}).get("times") or []
    check("G1 hhmm bookable", hhmm in times, f"times[:5]={times[:5]} looking for {hhmm}")

    st, body = api("GET", "/api/public/book/availability", query={"doctor_id": doctor_id})
    expect_status("G2 missing date → 400", st, 400, body)

    st, body = api("GET", "/api/public/book/availability",
                   query={"date": "not-a-date", "doctor_id": doctor_id})
    expect_status("G3 malformed date → 400", st, 400, body)

    st, body = api("GET", "/api/public/book/availability",
                   query={"date": iso_date, "doctor_id": "not-a-uuid"})
    expect_status("G4 invalid doctor_id → 400", st, 400, body)

    # ── POST /create — validation ────────────────────────────────────────
    print("\n== create · validation ==")
    st, body = _req("POST", f"{BASE}/api/public/book/create",
                    body="{not json", headers={"Content-Type": "application/json"})
    body = json.loads(body) if body else {}
    expect_status("P1 bad JSON → 400", st, 400, body)

    st, body = api("POST", "/api/public/book/create",
                   body={"patient_name": "أ", "patient_phone": phone,
                         "appointment_date": iso_date, "appointment_time": hhmm,
                         "doctor_id": doctor_id})
    expect_status("P2 short name → 400", st, 400, body)
    expect_msg_contains("P2 Arabic message", body, "الاسم")

    st, body = api("POST", "/api/public/book/create",
                   body={"patient_name": "مريض اختبار", "patient_phone": "abcxyz!!",
                         "appointment_date": iso_date, "appointment_time": hhmm,
                         "doctor_id": doctor_id})
    expect_status("P3 bad phone → 400", st, 400, body)
    expect_msg_contains("P3 Arabic message", body, "الهاتف")

    st, body = api("POST", "/api/public/book/create",
                   body={"patient_name": "مريض اختبار", "patient_phone": phone,
                         "appointment_date": iso_date, "appointment_time": "25:99",
                         "doctor_id": doctor_id})
    expect_status("P4 bad time → 400", st, 400, body)
    expect_msg_contains("P4 Arabic message", body, "وقت")

    st, body = api("POST", "/api/public/book/create",
                   body={"patient_name": "مريض اختبار", "patient_phone": phone,
                         "appointment_date": iso_date, "appointment_time": hhmm,
                         "doctor_id": "zzz"})
    expect_status("P5 invalid uuid → 400", st, 400, body)

    # ── POST /create — happy path + conflict ─────────────────────────────
    print("\n== create · happy path + conflict ==")
    payload = {"patient_name": "مريض اختبار", "patient_phone": phone,
               "appointment_date": iso_date, "appointment_time": hhmm,
               "doctor_id": doctor_id, "reason": "e2e"}
    st, body = api("POST", "/api/public/book/create", body=payload)
    expect_status("P6 valid booking → 200", st, 200, body)
    ref = (body or {}).get("reference") or ""
    check("P6 reference shape BAA-XXXXXXXX", bool(ref) and ref.startswith("BAA-") and len(ref) == 12,
          f"reference={ref!r}")

    st, body = api("POST", "/api/public/book/create", body=payload)
    expect_status("P7 same slot again → 409", st, 409, body)
    expect_msg_contains("P7 Arabic conflict", body, "محجوز")

    # ── POST /track ───────────────────────────────────────────────────────
    print("\n== track ==")
    st, body = api("POST", "/api/public/book/track",
                   body={"reference": ref, "phone": phone})
    expect_status("T1 valid track → 200", st, 200, body)

    st, body = api("POST", "/api/public/book/track",
                   body={"reference": "BAA-ZZZZZZZZ", "phone": phone})
    expect_status("T2 bad ref format → 400", st, 400, body)

    # ── POST /cancel ─────────────────────────────────────────────────────
    print("\n== cancel ==")
    st, body = api("POST", "/api/public/book/cancel",
                   body={"reference": "not-a-ref", "phone": phone})
    expect_status("C1 bad ref format → 400", st, 400, body)

    st, body = api("POST", "/api/public/book/cancel",
                   body={"reference": ref, "phone": "0500000000"})
    expect_status("C2 wrong phone → 404", st, 404, body)

    st, body = api("POST", "/api/public/book/cancel",
                   body={"reference": ref, "phone": phone})
    expect_status("C3 valid cancel → 200", st, 200, body)

    st, body = api("POST", "/api/public/book/cancel",
                   body={"reference": ref, "phone": phone})
    expect_status("C4 cancel again → 409", st, 409, body)
    expect_msg_contains("C4 Arabic already-cancelled", body, "ملغى")

    # ── Slot released → re-booking works ─────────────────────────────────
    print("\n== slot re-use after cancel ==")
    st, body = api("POST", "/api/public/book/create", body=payload)
    expect_status("R1 rebook same slot → 200", st, 200, body)

    # ── cleanup ──────────────────────────────────────────────────────────
    cleanup(phone)

    print()
    if FAILED:
        print(f"❌ {len(FAILED)} فحص فشل:")
        for f in FAILED:
            print(f"   - {f}")
        sys.exit(1)
    print("✅ كل السيناريوهات نجحت.")


if __name__ == "__main__":
    try:
        run()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        import traceback
        traceback.print_exc()
        print(f"\n!! خطأ غير متوقع: {e}", file=sys.stderr)
        sys.exit(2)
