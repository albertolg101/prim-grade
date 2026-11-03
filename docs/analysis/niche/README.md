# PrimGrade niche-analysis documents

These documents support validation of **PrimGrade**, a teacher-reviewed grading
assistant for photographed, handwritten university physics answers.

## Start here

1. Read [`niche_brief.md`](./niche_brief.md) for the current product direction,
   target user, evidence, and research queue.
2. Use [`analyst_agent.md`](./prompts/analyst_agent.md) for quantitative
   analysis and evidence-ledger rules.
3. Use [`competitor_scan.md`](./competitor_scan.md) for alternatives teachers
   use today, including manual grading and generic AI.
4. Use [`social_listening.md`](./social_listening.md) only with public,
   anonymized conversations.
5. Use [`journey_simulator.md`](./journey_simulator.md) and
   [`persona_simulator.md`](./prompts/persona_simulator.md) for hypotheses,
   never demand or accuracy claims.
6. Use [`deep_research_prompt.md`](./prompts/deep_research_prompt.md) for one
   externally sourced estimate at a time.

## Evidence rules

- Every number has a source, date, unit, and evidence kind:
  `open`, `partial`, `research`, `assumption`, or `simulated`.
- Separate user statements from measured pilot results.
- Simulated teachers can rank questions and wording; they cannot establish
  demand, grading accuracy, willingness to pay, or market size.
- Preserve privacy: use synthetic, anonymized, or explicitly authorized exam
  data and never include student names in prompts, exports, or examples.
- Do not describe a proposed score as final unless a teacher has approved it.
