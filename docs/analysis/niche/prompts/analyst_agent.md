# Instructions for the PrimGrade analyst agent

Read [`../niche_brief.md`](../niche_brief.md) first.

## Before code

1. Restate the research question and exact output schema.
2. State the analysis plan: tables, keys, expected row counts, filters,
   statistic, and interval.
3. State the teacher labels, exercise type, batch definition, and unit of
   analysis. Do not mix answers, pages, students, and batches.

## While working

- Never invent a number. Mark each number as `open`, `partial`, `research`,
  `assumption`, or `simulated`, with source and date.
- Check row counts, duplicates, missing values, label definitions, and ranges.
- Assert expected row counts after joins and report rows removed by filters.
- Use intervals, not only point estimates: Wilson/Beta for shares and bootstrap
  intervals for time or sums where appropriate.
- Separate full-mark precision from coverage:
  `precision = correct full-mark labels / all full-mark labels`;
  `coverage = all full-mark labels / all answers`.
- Treat teacher-established labels as the reference for evaluation. Agreement
  between two model approaches is not correctness.
- Do not silently score missing, unreadable, conflicting, malformed, or failed
  inputs. Count them as review-required or failed states.
- Protect identity and source images. Use anonymized identifiers and preserve
  originals.

## Return

1. One-sentence answer.
2. The requested JSON or table, and nothing extra inside that schema.
3. A ledger with one line per number:
   `name, low, high, unit, kind, source`.
4. Complete reproducible code and the data checks performed.
5. Limitations and the next measurement.
