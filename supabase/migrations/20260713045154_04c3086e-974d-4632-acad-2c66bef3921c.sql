-- Extend enqueue_appointment_reminders to also enqueue a WhatsApp reminder
-- row (24h before the appointment) that staff can send via the notifications
-- queue with one click.
CREATE OR REPLACE FUNCTION public.enqueue_appointment_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _appt public.appointments%ROWTYPE;
  _user_id uuid;
  _title text;
  _body text;
  _url text;
  _staff_title text;
  _kind text;
  _offset_min int;
  _target_ts timestamptz;
  _label_ar text;
  _ref8 text;
  _phone4 text;
  _wa_body text;
  _created int := 0;
  _staff_push int := 0;
  _user_push int := 0;
  _wa_created int := 0;
BEGIN
  FOR _appt IN
    SELECT a.* FROM public.appointments a
    WHERE a.status IN ('new','confirmed')
      AND a.reminder_offsets_minutes IS NOT NULL
      AND cardinality(a.reminder_offsets_minutes) > 0
      AND (a.appointment_date + a.appointment_time)::timestamptz
          BETWEEN now() + interval '5 minutes' AND now() + interval '10080 minutes' + interval '10 minutes'
  LOOP
    FOREACH _offset_min IN ARRAY _appt.reminder_offsets_minutes
    LOOP
      _target_ts := (_appt.appointment_date + _appt.appointment_time)::timestamptz - make_interval(mins => _offset_min);

      CONTINUE WHEN now() < _target_ts - interval '5 minutes'
                OR now() > _target_ts + interval '5 minutes';

      _kind := CASE _offset_min
                 WHEN 1440 THEN 'reminder_24h'
                 WHEN 120  THEN 'reminder_2h'
                 ELSE 'reminder_' || _offset_min::text || 'm'
               END;

      IF EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.appointment_id = _appt.id AND n.kind = _kind
      ) THEN
        CONTINUE;
      END IF;

      _label_ar := CASE
        WHEN _offset_min >= 1440 AND _offset_min % 1440 = 0
          THEN 'قبل ' || (_offset_min/1440)::text || ' يوم'
        WHEN _offset_min >= 60 AND _offset_min % 60 = 0
          THEN 'قبل ' || (_offset_min/60)::text || ' ساعة'
        ELSE 'قبل ' || _offset_min::text || ' دقيقة'
      END;

      _title := 'تذكير: موعدك ' || _label_ar;
      _body  := 'موعد ' || coalesce(_appt.patient_name,'') ||
                ' بتاريخ ' || to_char(_appt.appointment_date,'YYYY-MM-DD') ||
                ' الساعة ' || to_char(_appt.appointment_time,'HH24:MI');
      _staff_title := 'تذكير — موعد ' || _label_ar;
      _ref8 := substring(replace(_appt.id::text,'-','') for 8);
      _url := '/appointment-tracker?ref=' || _ref8;
      _phone4 := right(regexp_replace(coalesce(_appt.patient_phone,''),'\D','','g'), 4);

      _user_id := NULL;
      IF _appt.patient_id IS NOT NULL THEN
        SELECT p.profile_id INTO _user_id FROM public.patients p WHERE p.id = _appt.patient_id;
      END IF;
      IF _user_id IS NULL THEN
        SELECT pr.id INTO _user_id FROM public.profiles pr
        WHERE pr.phone IS NOT NULL
          AND regexp_replace(pr.phone,'\D','','g') = regexp_replace(coalesce(_appt.patient_phone,''),'\D','','g')
        LIMIT 1;
      END IF;

      IF _user_id IS NOT NULL THEN
        INSERT INTO public.notifications
          (audience,user_id,kind,title,body,appointment_id,branch_id,channel,send_status,sent_at,metadata)
        VALUES
          ('user',_user_id,_kind,_title,_body,_appt.id,_appt.branch_id,'in_app','sent',now(),
           jsonb_build_object('event',_kind,'offset_min',_offset_min,'url',_url));

        INSERT INTO public.notifications
          (audience,user_id,kind,title,body,appointment_id,branch_id,channel,send_status,metadata)
        VALUES
          ('user',_user_id,_kind,_title,_body,_appt.id,_appt.branch_id,'web_push','pending',
           jsonb_build_object('event',_kind,'offset_min',_offset_min,'url',_url));
        _user_push := _user_push + 1;
      END IF;

      -- WhatsApp reminder (24h only, patient audience, one row per appointment)
      IF _offset_min = 1440 AND coalesce(_appt.patient_phone,'') <> '' THEN
        _wa_body :=
          E'مرحبًا ' || coalesce(_appt.patient_name,'') || E'،\n' ||
          E'نذكّرك بموعدك في مجمع باعشن الطبي غدًا ' ||
          to_char(_appt.appointment_date,'YYYY-MM-DD') || E' الساعة ' ||
          to_char(_appt.appointment_time,'HH24:MI') || E'.\n' ||
          E'رقم الحجز: ' || _ref8 || E'\n' ||
          E'لمتابعة الحجز أو التعديل: ' || _url;

        INSERT INTO public.notifications
          (audience,user_id,kind,title,body,appointment_id,branch_id,channel,recipient,send_status,metadata)
        VALUES
          ('user',_user_id,_kind,_title,_wa_body,_appt.id,_appt.branch_id,'whatsapp',
           _appt.patient_phone,'pending',
           jsonb_build_object(
             'event',_kind,
             'offset_min',_offset_min,
             'ref', _ref8,
             'phone4', _phone4,
             'tracking_path', '/track?ref=' || _ref8 || '&phone4=' || _phone4,
             'patient_name', coalesce(_appt.patient_name,''),
             'appointment_date', to_char(_appt.appointment_date,'YYYY-MM-DD'),
             'appointment_time', to_char(_appt.appointment_time,'HH24:MI')
           ));
        _wa_created := _wa_created + 1;
      END IF;

      INSERT INTO public.notifications
        (audience,kind,title,body,appointment_id,branch_id,channel,send_status,sent_at,metadata)
      VALUES
        ('staff',_kind,_staff_title,_body,_appt.id,_appt.branch_id,'in_app','sent',now(),
         jsonb_build_object('event',_kind,'offset_min',_offset_min,'patient_phone',_appt.patient_phone,'url','/admin/appointments'));

      INSERT INTO public.notifications
        (audience,kind,title,body,appointment_id,branch_id,channel,send_status,metadata)
      VALUES
        ('staff',_kind,_staff_title,_body,_appt.id,_appt.branch_id,'web_push','pending',
         jsonb_build_object('event',_kind,'offset_min',_offset_min,'patient_phone',_appt.patient_phone,'url','/admin/appointments',
                            'staff_roles', jsonb_build_array('admin','reception','super_admin')));
      _staff_push := _staff_push + 1;

      _created := _created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'reminders_created', _created,
    'user_web_push_pending', _user_push,
    'staff_web_push_pending', _staff_push,
    'whatsapp_pending', _wa_created,
    'ran_at', now()
  );
END $$;