# PrimGrade niche brief

Updated: 3 November 2026. Status: product direction defined; performance,
demand, pricing, and capacity still require validation.

## Product and job

PrimGrade helps university physics teachers process batches of photographed,
handwritten exam answers. The teacher prepares a known exercise and rubric,
uploads potentially unordered photographs, and receives a proposed assessment:
answers that appear fully correct can be identified for careful confirmation,
while incomplete, incorrect, ambiguous, or uncertain answers receive a proposed
grade and explanatory comment for teacher review.

The job to be done is: **“When I have a large batch of handwritten physics
answers to mark, help me clear reliably correct answers and review the rest
faster, without losing control of the final grade.”**

Force/free-body diagrams are the initial technical focus because the user reports
that raw AI has particular difficulty evaluating them without an exercise-specific
harness. The niche is not restricted to engineering students or mechanics.

## Intended workflow

1. Create an exercise with its criteria, reference diagrams, acceptable
   variants, and partial-credit rules.
2. Prepare or configure an exercise-specific evaluator; this is exploratory,
   not an existing capability.
3. Assemble an exam from the exercise bank.
4. Upload unordered answer photographs and review exercise/student/page
   associations when uncertain.
5. Compare an exercise-specific evaluator with a raw LLM baseline.
6. Triage likely full-mark answers and propose grades/comments for the rest.
7. Review each answer beside its original image, edit the proposal, and approve
   the final result.

## Candidate pilot niches

| Candidate | User and job | Recruitment route | Status |
|---|---|---|---|
| **Primary: teachers marking their own exams** | University physics teachers with recurring handwritten batches who want to reduce personal marking time | Physics departments and direct introductions | User-defined target |
| Repeated assessment groups | Teachers reusing exercises across parallel groups who can amortise preparation | Teaching teams | Hypothesis |
| Large-course coordination | Course coordinators and teaching assistants who need consistent rubric-based review | Departmental pilots | Hypothesis |

These are alternative pilot segments, not additive market populations.

## Defined scope and open decisions

Defined: multiple physics exercise types; force diagrams as the initial
technical focus; exercise preparation and an exercise bank; unordered photos;
two assessment approaches; proposed grades and comments; visible evidence; and
teacher review, editing, and approval.

Open: how student identity and multi-page grouping work; how evaluator and raw
LLM disagreements are reconciled; whether full-mark answers are batch-confirmed
or individually approved; whether diagram highlights are feasible; pricing,
buyer, and deployment channel.

## Evidence ledger

- **User statements, 3 November 2026:** target users, workflow, force-diagram
  difficulty, 300-answer target batch, two assessment approaches, and review
  platform.
- **Not yet demonstrated:** full-mark precision, coverage, matching accuracy,
  net time saved, target-size capacity, adoption, willingness to pay, and
  operating cost.
- **Important distinction:** 300 answers is a product target, not measured
  capacity or market size. “Perfectly grade a share” is an aspiration, not an
  accuracy claim.

## Validation queue

1. Measure setup, sorting, review, correction, and total time against manual
   grading on teacher-labelled answers.
2. Measure full-mark precision and coverage separately on held-out answers.
3. Evaluate proposed grades and comments, including units, signs, vectors,
   alternative valid representations, ambiguous handwriting, and partial credit.
4. Test unordered-photo matching, duplicate images, missing pages, and
   ambiguous associations.
5. Compare the exercise-specific evaluator, raw LLM, their combination, and
   current teacher practice.
6. Run a 300-answer pilot and record failures, processing time, review time,
   and teacher corrections.
7. Validate buyer, channel, willingness to pilot, and eventual payment.

Do not claim market size, conversion, revenue, or a P10 outcome until the
required source and method exist. The primary next question is whether
high-precision full-mark identification plus assisted review produces meaningful
net teacher time savings.
