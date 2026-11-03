# Competitor scan — research instruction

Find what a university physics teacher would use instead of PrimGrade to mark
photographed handwritten answers. Include direct products and substitutes:
manual marking, teaching assistants, spreadsheets or LMS tools, generic OCR,
generic LLMs, specialist physics tools, and doing nothing.

For each alternative return one CSV row with exactly:
`alternative,type,price_month_eur,workflow,physics_support,image_support,ai_support,audience,source,checked`

- `type`: direct product, generic AI, institutional workflow, manual, or other.
- `price_month_eur`: cheapest paid plan per month in EUR when publicly stated;
  `0` for free; empty when unavailable. Never infer institutional or labour cost.
- `workflow`: the part of preparation, sorting, grading, or review it supports.
- `physics_support`, `image_support`, `ai_support`: `0` or `1`.
- `source`: the URL actually checked. `checked`: date checked.
- Include free and manual substitutes even when no pricing URL exists.
- If a page cannot be opened, retain the row and explain that in `source`.

Do not estimate users, revenue, accuracy, or teacher time saved unless a source
states the measure and definition. Put sourced claims in a separate evidence
table with population, method, date, and limitations. Do not treat marketing
claims as validation of grading correctness.
