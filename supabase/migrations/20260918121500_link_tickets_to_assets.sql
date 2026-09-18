-- Link tickets to inventory assets and validate the relation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_asset_id_fkey'
      AND conrelid = 'public.tickets'::regclass
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_asset_id_fkey
      FOREIGN KEY (asset_id)
      REFERENCES public.assets(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_tickets_asset_id
  ON public.tickets(asset_id);

CREATE OR REPLACE FUNCTION public.create_ticket(
  p_subject text,
  p_description text,
  p_category_id uuid DEFAULT NULL,
  p_service_id uuid DEFAULT NULL,
  p_asset_id uuid DEFAULT NULL,
  p_priority ticket_priority DEFAULT 'media',
  p_department_id uuid DEFAULT NULL
)
RETURNS public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_requester uuid := auth.uid();
  v_ticket public.tickets;
BEGIN
  IF v_requester IS NULL THEN
    RAISE EXCEPTION USING errcode = '28000', message = 'Usuário não autenticado';
  END IF;

  IF coalesce(length(trim(p_subject)), 0) < 5 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Assunto inválido';
  END IF;

  IF coalesce(length(trim(p_description)), 0) < 10 THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'Descrição inválida';
  END IF;

  IF p_department_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.departments d
    WHERE d.id = p_department_id AND d.is_active = true
  ) THEN
    RAISE EXCEPTION USING errcode = '23503', message = 'Setor do chamado inválido ou inativo';
  END IF;

  IF p_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.assets a WHERE a.id = p_asset_id
  ) THEN
    RAISE EXCEPTION USING errcode = '23503', message = 'Ativo do chamado não encontrado';
  END IF;

  INSERT INTO public.tickets(
    requester_id, category_id, service_id, asset_id, department_id,
    subject, description, priority
  )
  VALUES (
    v_requester, p_category_id, p_service_id, p_asset_id, p_department_id,
    trim(p_subject), trim(p_description), coalesce(p_priority, 'media')
  )
  RETURNING * INTO v_ticket;

  RETURN v_ticket;
END;
$function$;

NOTIFY pgrst, 'reload schema';
