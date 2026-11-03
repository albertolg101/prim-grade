# Physics Grader — Niche Brief

Updated: 3 November 2026 · Status: product direction defined; performance and demand to validate

## What is our niche?

Our niche is **university physics teachers who personally grade large batches of photographed, handwritten exam answers and want to reduce the time spent marking and reviewing them**.

Physics Grader prepares for known exam exercises in advance, identifies a share of answers that are fully correct, and proposes grades and explanatory comments for the remaining answers. A review platform lets teachers inspect each answer alongside its proposed grade and comment, confirm or adjust the assessment, and manage progress through the batch.

Teachers grade a range of physics exercises. **Force diagrams (free-body diagrams) are the initial technical focus because, according to the user, teachers have had particular difficulty evaluating them using raw AI without a supporting harness.** The harness is the exercise-specific instructions, tools, checks, and review workflow around the model; its effectiveness remains to be validated. The target workload is **300 submitted exercise answers per batch**. This is a user-stated product target, not measured capacity, a student count, or a market-size estimate. Introductory mechanics is a plausible starting context; a restriction to engineering students has not been established.

## The job to be done

“When I have a large batch of handwritten exam answers to mark, help me clear the fully correct answers reliably and review the others with a useful proposed grade and explanation, so I spend less time grading each answer myself.”

The central value is **net teacher time saved across the complete grading process**, including preparation, image organisation, checking, corrections, and final review.

## How the intended workflow works

1. **Create an exercise in advance.** The teacher adds the known problem and its assessment criteria. Reference diagrams, acceptable variants, and partial-credit rules are proposed preparation inputs.
2. **Prepare its evaluator.** Explore generating an exercise-specific tool or reusable evaluation skill before processing the batch. This is a proposed implementation approach, not an existing capability.
3. **Build an exam.** The teacher selects from previously added exercises.
4. **Upload photographs.** Answers arrive as pictures, potentially unordered. The system should organise them and associate them with the relevant exercises. Student identification, multi-page grouping, and the handling of ambiguous matches still need specification; uncertain associations should be reviewable.
5. **Assess through two approaches.** One assessment uses the prepared exercise-specific skill or tool; another uses a raw LLM (without harness) to interpret and assess the answer. How to reconcile their outputs remains an open design decision.
6. **Separate the review workload.** Aim to identify fully correct answers with very high reliability. For incomplete, incorrect, ambiguous, or otherwise uncertain answers, provide a proposed grade and a comment explaining the assessment for teacher review.
7. **Review answer by answer.** Show the original image, proposed grade, and comment together. The teacher can confirm or change the result and track what remains to review. Explore visual highlights of important parts of the handwritten diagram.

## What “correct” means for this product

The goal is to grade **a useful share of answers reliably**, primarily those deserving full marks, and make the rest faster to review. Perfect automated grading of every possible answer is not the product objective.

“Perfectly grade a share” is an aspiration to validate, not an established accuracy claim. The critical distinction is between **precision of the full-mark group** (how many answers labelled fully correct really are fully correct) and **coverage** (what share of all answers can enter that group). A cautious system may achieve high precision by leaving more answers for review. Agreement between the two grading approaches alone does not establish correctness.

Whether fully correct answers are automatically finalised, batch-confirmed, or individually approved is still to be decided. The review platform must support the teacher's chosen level of control.

## Session 9 — who × job × price × channel

| Dimension | Current definition | Status |
|---|---|---|
| Who | University physics teachers personally grading batches of handwritten exam answers across exercise types | User-defined target; force diagrams are the initial difficult use case |
| Job | Reduce manual grading and review time by identifying fully correct answers and proposing marks and comments for the rest | User-defined value proposition |
| Price | Not decided; test against measured time saved and purchasing authority | No willingness-to-pay evidence |
| Channel | Direct teacher introductions, physics departments, and teaching networks | Proposed recruitment channels; unvalidated |

We aim to keep total operating costs below US$10 per month for six exercises with 300 submitted answers each (1,800 answers per month), subject to validation.

## Candidate niches within this focus

These candidates overlap; they are alternatives for pilot recruitment, not additive market populations.

| Candidate | Who | Specific job | Where to listen / reach them |
|---|---|---|---|
| **Primary: teachers marking their own physics exams** | University physics teachers with recurring batches of handwritten physics answers | Reduce personal marking time using full-mark identification and assisted review | Physics departments and direct introductions |
| Repeated assessment in parallel course groups | Teachers reusing known physics exercises across groups | Amortise evaluator preparation across repeated batches | Physics teaching teams |
| Large-course grading coordination | Coordinators and teaching assistants sharing an exam and rubric | Manage the review queue and apply assessment criteria consistently | Course coordinators and departmental pilots |

## First product scope and open decisions

**Defined direction:** teachers grade different kinds of physics exercises, with force diagrams as the initial technical focus; exercise creation, exams assembled from an exercise bank, preparation before batch grading, photographic inputs that may be unordered, two grading approaches, reliable identification of fully correct answers, proposed grades and comments for the rest, and an answer-by-answer review platform.

**Exploratory features:** automatic creation of exercise-specific tools or skills and highlighting important parts of handwritten force diagrams. Highlighting should help the teacher inspect the evidence behind an assessment; it is not proof that the assessment is right.

## Evidence we have

- **User statements, 3 November 2026:** university teachers are the target; reducing personal exam-marking time is the purpose; teachers grade multiple physics exercise types; force diagrams are the initial focus because the user reports particular difficulty evaluating them with raw AI without a harness; input is photographs that may be unordered; preparation occurs against known exercises; the target batch is 300 exercise answers; the intended system combines specific evaluators, assessment by a raw LLM (without harness), and a review interface.
- **Course method:** Session 9 frames niche variants through who, job, price, and channel, with an explicit evidence ledger and research queue.
- **Not yet demonstrated:** grading precision, useful coverage, image-association accuracy, net time savings, batch capacity, teacher adoption, or willingness to pay. No project-specific pilot results or payment evidence were supplied. The course's Ritmo data does not establish demand for Physics Grader.

## Validation plan

1. **Measure the whole workflow.** Compare manual grading with assisted grading on comparable, teacher-labelled answer sets. Include exercise setup, evaluator preparation, image sorting, review, and corrections. Separate initial setup cost from the cost of subsequent batches.
2. **Validate full-mark precision and coverage separately.** Use held-out answers with teacher-established labels. Report incorrect answers wrongly awarded full marks, the share of all answers cleared as fully correct, and uncertainty in both measurements. Agree on acceptance thresholds before evaluation.
3. **Evaluate proposed grades and comments.** For the remaining answers, measure teacher corrections, review time, and whether comments accurately explain the proposed marks. Include missing and extra forces, wrong directions, unclear labels, alternative valid representations, and ambiguous handwriting.
4. **Test unordered photographs.** Evaluate exercise matching, duplicate images, missing pages, and ambiguous associations without treating a confident guess as a verified match.
5. **Compare the grading approaches and the raw-AI baseline.** Evaluate the exercise-specific evaluator and raw LLM (without harness) separately, then their combination, against teachers' current use of AI without a supporting harness. Use comparable force-diagram answers and measure assessment errors and total teacher time. Check whether disagreements help identify cases needing review.
6. **Run the target-size pilot.** Test a batch of 300 exercise answers and record completion, failures, processing time, review time, and teacher corrections. The batch size comes from the user's target, not observed performance.
7. **Validate buyer and channel.** Ask teachers and coordinators about current marking effort, purchasing authority, willingness to run a pilot, and eventual payment. Distinguish interest from paid commitment.

The next research priority is **whether sufficiently precise full-mark identification plus assisted review saves meaningful teacher time on real force-diagram answers**. Use force diagrams to test the core workflow first; this validation focus does not restrict the teacher niche to one exercise type. Market size, conversion, revenue intervals, and a P10-ranked niche remain unknown; every future numerical input must carry its source, date, unit, and evidence kind.

## Sources

- Product direction: user statements in this conversation, 3 November 2026.
- [Classroom course](https://classroom.google.com/c/ODg4Njk4NTM2MzE4)
- [Session 9 — Finding a niche with data and agents](https://drive.google.com/file/d/13nNXLZF_M4gPy76zJiGAMpTzMU8dxMs1/view), especially Part 8 and the lab.
- [Original niche brief template](https://drive.google.com/file/d/1YcD_8TppmRMZ642EQ9tApFkojHG93mYU/view)

