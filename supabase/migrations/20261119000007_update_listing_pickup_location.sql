-- Migration: Add pickup location fields to update_listing
-- Updates update_listing to persist pickup_hostel, pickup_lat, pickup_lng, pickup_note, and pickup_slots when editing listings.

do $$
declare
  d text;
  needle text := 'tags           = case when p_patch ? ''tags'' then array(select jsonb_array_elements_text(p_patch->''tags'')) else tags end';
  replacement text := 'tags           = case when p_patch ? ''tags'' then array(select jsonb_array_elements_text(p_patch->''tags'')) else tags end,' || chr(10) ||
                      '    pickup_hostel  = case when p_patch ? ''pickup_hostel'' then p_patch->>''pickup_hostel'' else pickup_hostel end,' || chr(10) ||
                      '    pickup_lat     = case when p_patch ? ''pickup_lat'' then (p_patch->>''pickup_lat'')::numeric else pickup_lat end,' || chr(10) ||
                      '    pickup_lng     = case when p_patch ? ''pickup_lng'' then (p_patch->>''pickup_lng'')::numeric else pickup_lng end,' || chr(10) ||
                      '    pickup_note    = case when p_patch ? ''pickup_note'' then p_patch->>''pickup_note'' else pickup_note end,' || chr(10) ||
                      '    pickup_slots   = case when p_patch ? ''pickup_slots'' then array(select jsonb_array_elements_text(p_patch->''pickup_slots'')) else pickup_slots end';
begin
  d := pg_get_functiondef('public.update_listing(uuid,uuid,timestamptz,jsonb)'::regprocedure);
  if position(needle in d) > 0 then
    execute replace(d, needle, replacement);
  end if;
end $$;
