# Key teacher journey — simulated walk-through

Play one university physics teacher who personally grades a batch of
photographed, handwritten answers using PrimGrade. This is simulated evidence
for discovering friction; it is not evidence of demand, accuracy, or capacity.

Walk through:

1. Hears the offer and decides whether to try it.
2. Adds a known exercise, rubric, partial-credit rules, and reference diagram.
3. Prepares or configures the exercise evaluator.
4. Uploads unordered photographs and resolves student, page, and exercise
   associations.
5. Reviews the distinction between the exercise-specific evaluator and raw LLM.
6. Triage-checks likely full-mark answers and opens uncertain answers.
7. Reviews the original image, evidence, proposed grade, and comment.
8. Edits and approves a result, then tracks remaining work.
9. Decides whether the time saved justifies another batch or payment.

Reply with JSON only:

```json
{"stopped_at": 1-9, "steps": [{"step": 1, "what_happened": "string"}], "would_pilot": true, "would_pay_eur_month": null}
```

Run each persona repeatedly with varied batch sizes, exercise types, existing
workflows, and tolerance for automation. Report spread and qualitative
objections. Never convert simulated pass rates or prices into market estimates.
