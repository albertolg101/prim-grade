# Competitor scan evidence

Checked: 3 November 2026

This report follows [competitor_scan.md](./competitor_scan.md). The CSV uses
the requested schema exactly. Prices are only recorded when the checked source
states that the software is free. Blank prices mean that the checked source did
not provide a public monthly EUR price; no labour, institutional, hosting, or
API cost was inferred.

## Sourced capability evidence

| Alternative | Claim supported by source | Population | Method | Date | Limitations |
|---|---|---|---|---|---|
| Google Classroom | Classroom supports assignment workflows, grading, rubrics, feedback, and submission management; Education Fundamentals is available at no cost to eligible institutions. | Eligible Google Workspace for Education institutions | Product documentation and edition description | 2026-11-03 | This describes workflow features, not physics grading quality, image understanding, or teacher time saved. |
| Moodle LMS | Moodle LMS is open-source software that supports assignment and grading workflows; deployment and hosting are separate concerns. | Institutions able to self-host or obtain hosting | Official project documentation | 2026-11-03 | The source does not establish zero total operating cost or suitability for handwritten-image assessment. |
| Microsoft Teams for Education | Teams for Education includes class collaboration and assignments and is available at no cost with a valid school account in the stated eligibility context. | Eligible schools and institutions | Official product page and education plan information | 2026-11-03 | Availability depends on institutional eligibility; no physics-specific or handwritten grading validation. |
| Azure AI Document Intelligence Read | The Read model extracts printed and handwritten text and returns document structure such as pages, lines, words, locations, and languages with the current v4.0 documentation. | Developers using the OCR service | Official technical documentation | 2026-11-03 | OCR output is not a physics interpretation or a grade; handwriting quality and domain notation require evaluation on PrimGrade data. |
| Azure structured outputs | Structured outputs can constrain model responses to a supplied JSON Schema, which is useful for validating proposal shape. | Developers using supported Azure OpenAI models/APIs | Official technical documentation | 2026-11-03 | Schema compliance does not establish factual, physical, or grading correctness. |
| Wolfram|Alpha | Wolfram|Alpha provides computational and mathematical capabilities, including paid Pro options and a free basic tier. | General users of the product | 2026-11-03 | It is a computational tool, not a workflow for associating photographed answers with students or approving rubric scores. |
| Gradescope | Gradescope is presented as an assessment and grading product with pricing handled through its pricing/institutional route. | Instructors and institutions | Official product/pricing page | 2026-11-03 | Public source checked did not provide a comparable monthly EUR price or evidence of physics handwritten-diagram grading accuracy. |
| ChatGPT | The official pricing page lists a free tier and paid plans; multimodal use is a general capability, not a validated grading workflow. | General users and individual teachers | Official pricing/product information | 2026-11-03 | Plan limits, model availability, and image behaviour can change; no PrimGrade-specific accuracy or time-saving claim is used. |
| Claude | The official pricing page lists a free tier and paid plans; image/document analysis is a general capability. | General users and individual teachers | Official pricing/product information | 2026-11-03 | No physics-specific grading validation or public comparable monthly EUR price is claimed. |

## Published evaluation evidence

| Source | Population | Method | Date | Result relevant to PrimGrade | Limitations |
|---|---|---|---|---|---|
| [Kortemeyer, Nöhl, and Onishchuk, *Physical Review Physics Education Research*](https://doi.org/10.1103/PhysRevPhysEducRes.20.020144) | 252 students in a high-stakes thermodynamics exam with four multipart problems | Exploratory comparison of four AI-assisted grading workflows for handwritten solutions | 2024-11-12 | The abstract reports that handwriting conversion was a major challenge, fine-grained whole-problem rubrics caused tracking errors, hand-drawn graphics were less reliable than mathematical derivations, and failing cases still required human grading. | This is one study in thermodynamics, not a PrimGrade pilot; its results cannot be transferred directly to force diagrams, models, institutions, or time savings. |

## Interpretation for PrimGrade

The closest substitutes divide into three groups:

1. **Human and institutional workflows:** manual marking, teaching assistants,
   spreadsheets, LMSs, and Teams. These support organisation, rubric work, and
   teacher review but do not solve physics-aware interpretation of photographs.
2. **General AI and OCR:** ChatGPT, Claude, and Azure Document Intelligence.
   These can inspect images or extract text, but the checked sources do not
   establish reliable criterion-level physics grading.
3. **Specialist tools:** Gradescope provides an assessment workflow and
   Wolfram|Alpha provides computation. Neither checked source establishes the
   complete PrimGrade workflow of unordered-photo association, handwriting
   transcription, physics interpretation, evidence-linked rubric proposals,
   and teacher approval.

The strongest implementation implication is to compete on the **combined
workflow and review evidence**, not on generic image chat or gradebook
features. The APS study supports treating handwriting conversion, rubric
granularity, diagrams, and failing/uncertain answers as explicit evaluation
risks.

No user counts, market size, accuracy, revenue, willingness-to-pay, or teacher
time-saving estimate is included because the checked sources did not provide a
comparable PrimGrade measure.
