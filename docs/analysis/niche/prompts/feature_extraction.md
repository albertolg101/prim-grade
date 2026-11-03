# Feature extraction from teacher feedback

Read one anonymized teacher interview answer, pilot note, review, or product
description and identify which allowed PrimGrade features it mentions.

Use only names supplied in the user message. Suggested feature names include:
`exercise_setup`, `rubric_setup`, `photo_upload`, `page_matching`,
`student_matching`, `transcription`, `physics_interpretation`,
`full_mark_triage`, `proposed_grade`, `explanatory_comment`, `evidence_view`,
`diagram_highlight`, `teacher_edit`, `teacher_approval`, `review_queue`,
`raw_llm_baseline`, and `exercise_specific_evaluator`.

For each feature classify `+` (works or valued), `-` (fails, missing, or
costly), or `0` (mentioned only). Identify the speaker only when explicitly
stated: `teacher`, `coordinator`, `teaching_assistant`, `student`, or `null`.
Never infer identity.

Reply with JSON only:

```json
{"features":["teacher_approval"],"valence":{"teacher_approval":"+"},"other":[],"group":"teacher","quote":"<<=15 words copied exactly>"}
```

Validate extraction against a manually labelled sample before using it for
prioritisation. Feature mentions do not establish demand or product success.
