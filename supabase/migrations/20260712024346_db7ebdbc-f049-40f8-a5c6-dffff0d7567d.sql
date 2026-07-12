
-- =========================================================
-- إلغاء طلبات الصيدلية / الرأي الطبي الثاني / الرعاية المنزلية
-- + إشعارات موظفين عند تغيّر الحالة
-- =========================================================

-- 1) RPC: cancel_order_by_ref
CREATE OR REPLACE FUNCTION public.cancel_order_by_ref(
  _ref text,
  _phone text,
  _kind text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _p text := regexp_replace(coalesce(_phone,''),'\D','','g');
  _target_id uuid;
  _cur_status text;
BEGIN
  IF _ref IS NULL OR length(_ref) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_ref');
  END IF;
  IF length(_p) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;

  IF _kind = 'pharmacy' THEN
    SELECT id, status::text INTO _target_id, _cur_status
    FROM public.medicine_orders
    WHERE substring(replace(id::text,'-','') for 8) = lower(_ref)
      AND regexp_replace(patient_phone,'\D','','g') = _p
    LIMIT 1;

    IF _target_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
    IF _cur_status IN ('delivered','cancelled','completed') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', _cur_status);
    END IF;

    UPDATE public.medicine_orders
       SET status = 'cancelled',
           notes = COALESCE(notes,'') ||
                   CASE WHEN _reason IS NOT NULL AND length(_reason) > 0
                        THEN E'\n[إلغاء من المريض] ' || _reason ELSE '' END
     WHERE id = _target_id;

  ELSIF _kind = 'second_opinion' THEN
    SELECT id, status INTO _target_id, _cur_status
    FROM public.second_opinion_requests
    WHERE substring(replace(id::text,'-','') for 8) = lower(_ref)
      AND regexp_replace(phone,'\D','','g') = _p
    LIMIT 1;

    IF _target_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
    IF _cur_status IN ('closed','answered','cancelled') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', _cur_status);
    END IF;

    UPDATE public.second_opinion_requests
       SET status = 'cancelled'
     WHERE id = _target_id;

  ELSIF _kind = 'home_care' THEN
    SELECT id, status INTO _target_id, _cur_status
    FROM public.home_care_requests
    WHERE substring(replace(id::text,'-','') for 8) = lower(_ref)
      AND regexp_replace(patient_phone,'\D','','g') = _p
    LIMIT 1;

    IF _target_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
    IF _cur_status IN ('completed','cancelled','in_progress') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', _cur_status);
    END IF;

    UPDATE public.home_care_requests
       SET status = 'cancelled',
           notes  = COALESCE(notes,'') ||
                    CASE WHEN _reason IS NOT NULL AND length(_reason) > 0
                         THEN E'\n[إلغاء من المريض] ' || _reason ELSE '' END
     WHERE id = _target_id;

  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unsupported_kind');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _target_id, 'status', 'cancelled');
END $$;

REVOKE ALL ON FUNCTION public.cancel_order_by_ref(text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_order_by_ref(text, text, text, text) TO anon, authenticated;


-- 2) Trigger: staff in-app notification when non-appointment order status changes
CREATE OR REPLACE FUNCTION public.trg_order_status_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _kind text := TG_ARGV[0];
  _ref  text;
  _title text;
  _body  text;
  _new_status text := NEW.status::text;
  _old_status text := OLD.status::text;
  _branch uuid;
BEGIN
  IF _new_status IS NOT DISTINCT FROM _old_status THEN
    RETURN NEW;
  END IF;

  _ref := substring(replace(NEW.id::text,'-','') for 8);
  _branch := CASE WHEN TG_TABLE_NAME = 'medicine_orders' THEN NEW.branch_id ELSE NULL END;

  _title := CASE _kind
    WHEN 'pharmacy'       THEN 'تحديث حالة طلب صيدلية'
    WHEN 'second_opinion' THEN 'تحديث حالة رأي طبي ثاني'
    WHEN 'home_care'      THEN 'تحديث حالة طلب رعاية منزلية'
    ELSE 'تحديث حالة طلب'
  END;
  _body := format('طلب #%s انتقل من %s إلى %s', _ref, _old_status, _new_status);

  INSERT INTO public.notifications
    (audience, kind, title, body, branch_id, channel, send_status, sent_at, metadata)
  VALUES
    ('staff',
     'order_status_' || _kind,
     _title,
     _body,
     _branch,
     'in_app',
     'sent',
     now(),
     jsonb_build_object(
       'kind', _kind,
       'reference', _ref,
       'order_id', NEW.id,
       'old_status', _old_status,
       'new_status', _new_status
     )
    );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_medicine_orders_status_notify ON public.medicine_orders;
CREATE TRIGGER trg_medicine_orders_status_notify
AFTER UPDATE OF status ON public.medicine_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_order_status_notify('pharmacy');

DROP TRIGGER IF EXISTS trg_second_opinion_status_notify ON public.second_opinion_requests;
CREATE TRIGGER trg_second_opinion_status_notify
AFTER UPDATE OF status ON public.second_opinion_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_order_status_notify('second_opinion');

DROP TRIGGER IF EXISTS trg_home_care_status_notify ON public.home_care_requests;
CREATE TRIGGER trg_home_care_status_notify
AFTER UPDATE OF status ON public.home_care_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_order_status_notify('home_care');
