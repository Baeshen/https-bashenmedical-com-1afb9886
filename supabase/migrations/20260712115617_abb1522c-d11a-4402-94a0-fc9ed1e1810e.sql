-- ============ INTERNAL HELPERS: revoke from all (used by triggers/other functions) ============
REVOKE EXECUTE ON FUNCTION public._appointment_belongs_to_me(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_branch_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_staff() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._emit_appointment_notification(public.appointments, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._enforce_owner_cancel_only() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_doctor_primary_branch() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_reminder_preference_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_appointments_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_order_status_notify() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_doctor_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_appointment_reminders() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, uuid, text, text, text, jsonb, text, text) FROM PUBLIC, anon;

-- ============ STAFF/ADMIN-ONLY: revoke from anon, keep authenticated (function body checks role) ============
REVOKE EXECUTE ON FUNCTION public.dashboard_appointments_daily(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_by_specialty(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_kpis(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_peak_hours(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_recent_activity(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_status_breakdown(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_upcoming(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.doctor_occupancy(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_doctor_leaves(date, date, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_pharmacy_prescriptions(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pharmacy_review_prescription(uuid, text, text, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reply_to_rating(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ratings_summary(uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_user_role(uuid, app_role, uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.revoke_user_role(uuid, app_role, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_role_permission(app_role, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_role_permissions_matrix() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_permissions_catalog() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_users_with_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.patient_qr_scan_stats(uuid[]) FROM PUBLIC, anon;

-- ============ AUTHENTICATED-USER-ONLY (self-service): revoke from anon ============
REVOKE EXECUTE ON FUNCTION public.my_appointments() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_appointments_with_reminders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_notifications(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_reminder_preference_audit(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_patient_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.release_slot(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_branch_access(uuid, uuid) FROM PUBLIC, anon;

-- Public functions (list_public_*, book_slot, lookup_*, cancel_*_by_ref, track_*, submit_public_rating,
-- log_auth_event, specialty_doctor_counts, list_doctors_next_slot, doctor_next_available_date)
-- intentionally remain executable by anon for guest booking and public browsing.