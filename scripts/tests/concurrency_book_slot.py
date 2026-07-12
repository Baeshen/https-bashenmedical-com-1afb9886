#!/usr/bin/env python3
"""
Concurrency test — public.book_slot
------------------------------------
Fires N parallel bookings against a single availability slot and verifies
exactly one succeeds while the rest are rejected with an expected SQLSTATE
(slot_unavailable / unique_violation).

Requires the managed psql environment (PGHOST etc. from the sandbox).
Run:  python3 scripts/tests/concurrency_book_slot.py
"""
import sys, random, concurrent.futures as cf, subprocess, datetime, os

PARALLEL = int(os.environ.get("PARALLEL", "25"))
DOCTOR   = os.environ.get("TEST_DOCTOR_ID", "c951d838-3dce-45ab-a908-942a898fdc08")
BRANCH   = os.environ.get("TEST_BRANCH_ID", "561486ad-15f3-4a51-a948-3717db029a89")


def psql(sql: str, quiet: bool = False) -> str:
    r = subprocess.run(
        ["psql", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-c", sql],
        capture_output=True, text=True,
    )
    if r.returncode != 0 and not quiet:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.strip()


def classify(msg: str) -> str:
    if "23505" in msg or "unique_violation" in msg or "محجوز" in msg:
        return "UNIQUE_VIOLATION"
    if "23514" in msg or "slot_unavailable" in msg:
        return "SLOT_UNAVAILABLE"
    return "OTHER"


def main() -> int:
    # Unique future slot per run (exec env has no DELETE perm)
    d  = (datetime.date.today() + datetime.timedelta(days=400 + random.randint(0, 300))).isoformat()
    mm = random.randint(0, 59)
    ss = random.randint(0, 59)
    t_start = f"22:{mm:02d}:{ss:02d}"
    t_end   = f"23:{mm:02d}:{ss:02d}"

    slot_id = psql(
        f"WITH ins AS (INSERT INTO availability_slots "
        f"(doctor_id, branch_id, slot_date, start_time, end_time, status) VALUES "
        f"('{DOCTOR}','{BRANCH}','{d}','{t_start}','{t_end}','available') "
        f"RETURNING id) SELECT id FROM ins;"
    )
    print(f"[setup] slot_id={slot_id} date={d} time={t_start}  parallel={PARALLEL}")

    def attempt(i: int):
        sql = (
            f"SELECT public.book_slot('{slot_id}'::uuid, "
            f"'Test-{i}', '05000000{i:02d}', NULL, NULL, NULL, "
            f"'concurrency-test', NULL, NULL);"
        )
        r = subprocess.run(["psql", "-A", "-t", "-c", sql], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return (i, "OK", r.stdout.strip())
        return (i, classify(r.stderr.replace("\n", " ")), r.stderr.replace("\n", " ")[:200])

    with cf.ThreadPoolExecutor(max_workers=PARALLEL) as ex:
        results = list(ex.map(attempt, range(PARALLEL)))

    wins  = [r for r in results if r[1] == "OK"]
    uniq  = [r for r in results if r[1] == "UNIQUE_VIOLATION"]
    unav  = [r for r in results if r[1] == "SLOT_UNAVAILABLE"]
    other = [r for r in results if r[1] == "OTHER"]

    print(
        f"\n[results] total={len(results)} wins={len(wins)} "
        f"unique_violation={len(uniq)} slot_unavailable={len(unav)} other={len(other)}"
    )
    for r in wins:
        print(f"   WIN   #{r[0]:02d} -> appt_id={r[2]}")
    for r in other:
        print(f"   OTHER #{r[0]:02d} -> {r[2]}")

    db_appts = psql(
        f"SELECT count(*) FROM appointments "
        f"WHERE doctor_id='{DOCTOR}' AND appointment_date='{d}' AND appointment_time='{t_start}' "
        f"AND status IN ('new','confirmed','completed');"
    )
    db_slot = psql(f"SELECT status FROM availability_slots WHERE id='{slot_id}';")
    print(f"\n[db] active_appts_at_slot={db_appts}  slot.status={db_slot}")
    print(f"[note] test rows left in DB (exec has no DELETE perm): slot={slot_id}")

    ok = (
        len(wins) == 1
        and len(other) == 0
        and db_appts == "1"
        and db_slot == "booked"
        and (len(uniq) + len(unav)) == PARALLEL - 1
    )
    print("\n" + ("PASS ✅" if ok else "FAIL ❌"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
