
-- =========================================================
-- Tighten EXECUTE on SECURITY DEFINER functions
-- =========================================================

-- ---------- 1) Internal / trigger / helper functions: REVOKE from everyone ----------
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public._appointment_belongs_to_me(text)',
    'public._assert_branch_access(uuid)',
    'public._assert_staff()',
    'public._emit_appointment_notification(public.appointments, text, text, text)',
    'public._enforce_owner_cancel_only()',
    'public.audit_row_change()',
    'public.enqueue_appointment_reminders()',
    'public.handle_new_user()',
    'public.log_appointment_change()',
    'public.log_reminder_preference_change()',
    'public.notify_on_reminder_preference_change()',
    'public.refresh_doctor_rating()',
    'public.sync_doctor_primary_branch()',
    'public.trg_appointments_notify()',
    'public.trg_order_status_notify()',
    'public.log_security_event(text, uuid, text, text, text, jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END$$;

-- ---------- 2) Staff/admin functions: authenticated only ----------
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.assign_user_role(uuid, public.app_role, uuid, text, text)',
    'public.revoke_user_role(uuid, public.app_role, text, text)',
    'public.set_role_permission(public.app_role, text, boolean)',
    'public.list_users_with_roles()',
    'public.list_role_permissions_matrix()',
    'public.list_permissions_catalog()',
    'public.dashboard_appointments_daily(uuid, integer)',
    'public.dashboard_by_specialty(uuid, integer)',
    'public.dashboard_kpis(uuid)',
    'public.dashboard_peak_hours(uuid, integer)',
    'public.dashboard_recent_activity(uuid, integer)',
    'public.dashboard_status_breakdown(uuid, integer)',
    'public.dashboard_upcoming(uuid, integer)',
    'public.doctor_occupancy(uuid, integer)',
    'public.get_ratings_summary(uuid, uuid, integer)',
    'public.reply_to_rating(uuid, text)',
    'public.list_doctor_leaves(date, date, uuid, uuid)',
    'public.list_pharmacy_prescriptions(uuid, text)',
    'public.pharmacy_review_prescription(uuid, text, text, uuid, integer)',
    'public.generate_mrn(uuid)',
    'public.patient_qr_scan_stats(uuid[])',
    'public.can_access_patient(uuid)',
    'public.can_write_patient_clinical(uuid)',
    'public.has_branch_access(uuid, uuid)',
    'public.has_permission(uuid, text)',
    'public.has_role(uuid, public.app_role)',
    'public.get_my_patient_id()',
    'public.my_appointments()',
    'public.my_appointments_with_reminders()',
    'public.my_notifications(integer)',
    'public.mark_notifications_read(uuid[])',
    'public.my_reminder_preference_audit(uuid)',
    'public.release_slot(uuid)',
    'public.log_security_event(text, uuid, text, text, text, jsonb, text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END$$;

-- ---------- 3) Public functions: anon + authenticated only (revoke PUBLIC blanket) ----------
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.book_slot(uuid, text, text, text, text, text, text, text, uuid)',
    'public.cancel_appointment_by_ref(text, text, text)',
    'public.cancel_order_by_ref(text, text, text, text)',
    'public.doctor_next_available_date(uuid, uuid)',
    'public.get_order_by_ref(text, text, text)',
    'public.get_public_doctor_rating_summary(uuid)',
    'public.list_appointment_audit_by_ref(text, text)',
    'public.list_doctors_next_slot(uuid[])',
    'public.list_public_branches()',
    'public.list_public_branches_for_rating()',
    'public.list_public_doctor_ratings(uuid, integer)',
    'public.list_public_doctors(text, uuid, text, text, text, integer, integer)',
    'public.list_public_doctors_for_rating(uuid)',
    'public.list_public_excellence_centers(uuid)',
    'public.list_reminder_preferences_by_ref(text, text)',
    'public.log_auth_event(text, uuid, text, text, text, jsonb)',
    'public.lookup_appointment(text, text)',
    'public.lookup_complaint(text, text)',
    'public.reschedule_appointment_by_ref(text, text, date, time, text)',
    'public.specialty_doctor_counts()',
    'public.submit_public_rating(uuid, uuid, smallint, text, text, text, text)',
    'public.track_appointment(text, text)',
    'public.track_orders_by_phone(text)',
    'public.update_reminders_by_ref(text, text, boolean, boolean, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
  END LOOP;
END$$;
