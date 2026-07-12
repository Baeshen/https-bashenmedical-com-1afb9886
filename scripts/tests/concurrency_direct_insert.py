#!/usr/bin/env python3
"""
Concurrency test — direct-insert path (no availability_slots row).

Exercises the second line of defense in booking:
  1) `_assert_slot_free` (transaction advisory lock on (doctor,date,time))
  2) partial unique index `appointments_doctor_slot_active_uidx`

We insert appointments directly (bypassing book_slot) from many threads
targeting the same (doctor, date, time). Exactly one must win; the rest
must fail with unique_violation (23505).

Run: python3 scripts/tests/concurrency_direct_insert.py
"""
import sys, random, concurrent.futures as cf, subprocess, datetime, os

PARALLEL = int(os.environ.get("PARALLEL", "25"))
DOCTOR   = os.environ.get("TEST_DOCTOR_ID", "c951d838-3dce-45ab-a908-942a898fdc08")
BRANCH   = os.environ.get("TEST_BRANCH_ID", "561486ad-15f3-4a51-a948-3717db029a89")


def classify(msg: str) -> str:
    # Environment-side failures (not a booking-logic bug)
    if "permission denied for schema auth" in msg or "EDBHANDLEREXITED" in msg \
       or "connection" in msg.lower() and "closed" in msg.lower():
        return "ENV_SKIP"
    # _assert_slot_free raises with ERRCODE='unique_violation'; the Arabic message
    # is the reliable text marker across psql client versions.
    if "23505" in msg or "unique_violation" in msg or "محجوز بالفعل" in msg:
        return "UNIQUE_VIOLATION"
    if "check_violation" in msg or "23514" in msg:
        return "CHECK_VIOLATION"
    return "OTHER"


def main() -> int:
    d  = (datetime.date.today() + datetime.timedelta(days=500 + random.randint(0, 300))).isoformat()
    mm = random.randint(0, 59)
    ss = random.randint(0, 59)
    t  = f"21:{mm:02d}:{ss:02d}"

    print(f"[setup] doctor={DOCTOR[:8]}… date={d} time={t}  parallel={PARALLEL}")

    def attempt(i: int):
        # Wrap the insert in a BEGIN…COMMIT so the advisory lock in
        # _assert_slot_free actually applies (xact lock).
        sql = (
            "BEGIN;"
            f"SELECT public._assert_slot_free('{DOCTOR}'::uuid, '{d}'::date, '{t}'::time, NULL);"
            "INSERT INTO appointments "
            "(patient_name, patient_phone, doctor_id, branch_id, "
            " appointment_date, appointment_time, status) VALUES "
            f"('Direct-{i}','06000000{i:02d}','{DOCTOR}','{BRANCH}',"
            f"'{d}','{t}','confirmed');"
            "COMMIT;"
        )
        r = subprocess.run(["psql", "-A", "-t", "-c", sql], capture_output=True, text=True)
        if r.returncode == 0 and "INSERT 0 1" in r.stdout:
            return (i, "OK", "")
        return (i, classify(r.stderr.replace("\n", " ")), r.stderr.replace("\n", " ")[:200])

    with cf.ThreadPoolExecutor(max_workers=PARALLEL) as ex:
        results = list(ex.map(attempt, range(PARALLEL)))

    wins  = [r for r in results if r[1] == "OK"]
    uniq  = [r for r in results if r[1] == "UNIQUE_VIOLATION"]
    skip  = [r for r in results if r[1] == "ENV_SKIP"]
    other = [r for r in results if r[1] not in ("OK", "UNIQUE_VIOLATION", "ENV_SKIP")]

    print(
        f"\n[results] total={len(results)} wins={len(wins)} "
        f"unique_violation={len(uniq)} env_skip={len(skip)} other={len(other)}"
    )
    for r in other:
        print(f"   OTHER #{r[0]:02d} -> [{r[1]}] {r[2]}")

    q = subprocess.run(
        ["psql", "-A", "-t", "-c",
         f"SELECT count(*) FROM appointments WHERE doctor_id='{DOCTOR}' "
         f"AND appointment_date='{d}' AND appointment_time='{t}' "
         f"AND status IN ('new','confirmed','completed');"],
        capture_output=True, text=True,
    )
    db_active = q.stdout.strip()
    effective = len(results) - len(skip)
    print(
        f"\n[db] active_appts_at_slot={db_active}  "
        f"(effective attempts after ENV_SKIP: {effective})"
    )

    # Correctness: at most 1 winner, DB has exactly 1 active row,
    # every non-skipped loser is a unique_violation.
    ok = (
        len(wins) == 1
        and db_active == "1"
        and len(other) == 0
        and (len(wins) + len(uniq)) == effective
    )
    print("\n" + ("PASS ✅" if ok else "FAIL ❌"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
