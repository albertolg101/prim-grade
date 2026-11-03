# Competitor scan prompt

Find alternatives a university physics teacher could use instead of PrimGrade:
manual marking, teaching assistants, LMS and spreadsheet workflows, generic
OCR/LLM tools, specialist physics software, and direct grading assistants.

For every alternative return a CSV row with exactly:
`alternative,type,price_month_eur,physics_support,image_support,ai_support,teacher_review,workflow,source,checked`

Use `0/1` for support fields. Use an empty price when it is unavailable;
never infer labour, institutional, or API cost. Check pricing and feature
claims at their source URL and date. Add a second evidence table for any
published users, accuracy, or time-saving claims, including definition,
population, method, and limitations. A marketing claim is not validation.
