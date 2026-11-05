# Platform specification

Status: Draft, not implemented. Updated: 5 November 2026.
Owner requirements: given in chat on 5 November 2026 (kind: owner decision).
Directive: [`docs/directive.md`](../directive.md), invariants I1–I5. Grading: [`grader.md`](grader.md).
Technical choices: [ADR-0001](../adr/0001-platform-stack.md).

## Why

The grader library (`grader/`) was tested with one real teacher on 3–5 November 2026. The platform
puts it in front of teachers and their students. The goal is the directive's: less total teacher
time spent grading, with the teacher deciding every final grade.

## Who

- **Admin**: a teacher who also approves sign-ups, grants admin rights and watches spending.
- **Teacher**: prepares problems, builds exams, collects answers, reviews and approves grades.
- **Student**: has no account. Opens a link or QR code from the teacher, types their name and
  uploads their own answers. Assumed to try to game any gap and to blame the system
  (see `tools/wave/personas.yaml`).

## User situations

- **US.P01**: A new teacher wants an account and waits for an admin to let them in.
- **US.P02**: The first person to sign up becomes the admin of the installation.
- **US.P03**: A teacher has a problem on paper and wants it in the tool from a phone or a laptop.
- **US.P04**: A teacher has only a title so far and wants to save it and finish later.
- **US.P05**: The AI's reading of a problem (rubric, answers, assumptions) is partly wrong, and the
  teacher wants to fix it by editing or by telling the AI what to change.
- **US.P06**: A teacher has a pile of paper answers and wants them graded.
- **US.P07**: A teacher reviews one answer at a time, with the paper big beside the AI's grade.
- **US.P08**: A teacher gives the final grade and records whether the AI was right, and why not.
- **US.P09**: A teacher assembles an exam from existing problems, or new ones, for one class group.
- **US.P10**: Students in a room upload their own answers from their phones during a short window.
- **US.P12**: A student tries to submit answers under another student's name from the same browser;
  the platform refuses that submission and directs legitimate shared-device users to the teacher.
- **US.P11**: A teacher or the admin wants to know where the money went.

## Requirements

Each requirement has a stable id; tests and tasks cite it.

### Accounts and admin

- **PL-01 Sign-up with approval.** Anyone can sign up with email, name and password. A new account
  is *pending* and cannot sign in until an admin approves it. Rejected accounts cannot sign in.
- **PL-02 First user is admin.** The first account created on an empty installation is approved
  and admin at once.
- **PL-03 Admin management.** An admin approves or rejects pending accounts, grants or removes
  admin rights, and can deactivate a teacher. The last remaining admin cannot lose admin rights.
- **PL-04 Sign-in and sign-out.** Approved teachers sign in with email and password and stay signed
  in on that device until they sign out or the session expires.
- **PL-05 Admin spending view.** An admin sees, per teacher, tokens used and US$ spent, in total and
  by month.

### Settings (per teacher)

- **PL-06 OpenAI API key.** Each teacher stores their own OpenAI API key. Their AI calls are billed
  to that key. After saving, the key is never shown in full again (only its last 4 characters),
  and it never appears in logs, prompts or the admin view. AI actions are disabled, with a message
  pointing to Settings, until a key is saved.
- **PL-07 Theme.** Follows the system light or dark setting by default; the teacher can choose
  light, dark or system with three buttons on the right of the top bar, on every page.
- **PL-48 Dates** (owner request, 6 November 2026). Every date in the interface follows one rule,
  in the interface language: today shows only the time, 24-hour without seconds ("14:05");
  yesterday shows "Yesterday"; earlier this year shows day and month ("6 Nov"); before this year
  adds the year ("31 Dec 2025").
- **PL-37 Language** (owner request, 5 November 2026). A menu in the top bar, next to the theme
  buttons, sets the language to English, Spanish or Russian. It changes every interface text at
  once and is saved per teacher. Every AI call (problem setup, revision and grading) uses the
  teacher's language at the time of the call through the grader's `language_rule`: explanations,
  rubric and feedback are in that language; transcriptions and quotes stay as written. The problem
  and each grading run record the language used. The sign-in page and the student page have the
  same menu; their choice stays in that browser. Server messages that have a translation are shown
  translated; the others stay in English.
- **PL-08 Upload-link duration.** The default lifetime of a student upload link is 10 minutes. Each
  teacher can change their default.

### Look and navigation

- **PL-09 Tabs.** A signed-in teacher moves between **Problems**, **Exams**, **Groups** and
  **Settings** in a left sidebar; admins also see **Admin**. On a phone the sidebar is a drawer
  opened from the top bar.
- **PL-38 Breadcrumbs** (owner request, 5 November 2026). The left of the top bar shows where the
  teacher is (for example *Exams › Exam › Ana*); each earlier step is a link. On a phone only the
  current page is shown.
- **PL-39 Zoom** (owner request, 5 November 2026). A thin footer on every page has −, the current
  level (press to return to 100 %) and +, from 75 % to 200 %. A web page cannot change the browser's
  own zoom, so the app scales its root font size (every size is in rem); dialogs and menus zoom
  with it and open in the right place. CSS `zoom` was tried first and dropped: dropdowns opened
  off-screen because they are placed in on-screen pixels. The footer keeps
  its size at every level and sits beside the sidebar on a computer (full width on a phone, where
  the sidebar is a drawer). The level is kept per browser, since it depends on the screen.
- **PL-10 Colours.** Dark mode uses yellow as the primary colour; light mode uses blue.
- **PL-11 Phone and computer.** Every screen works on a phone (from 360 px wide, touch) and on a
  computer. On a phone the one-answer review (PL-22) stacks the image above the grade.
  Pages use the whole screen width; their parts sit two per row and wrap to one column on narrow
  screens (owner request, 5 November 2026).
  An odd last part keeps its half width. Text fields side by side share one height, the height
  the longest text needs; in rubric criterion cards and in the statement and solution blocks the
  rows of fields line up across the two columns.

### Capture

- **PL-12 Three ways in.** Wherever images are added (problem statement and solution, answers,
  student link): browse for files, drag and drop (computer), or **Scan**.
- **PL-13 Scan.** *Scan* opens the camera. The teacher or student presses the shutter, the page is
  detected, cropped and straightened like a document scanner, and shown for *Use*, *Retake* or
  *Adjust corners*. Several pages can be scanned in a row as one multi-page item.
- **PL-14 Originals kept.** Every uploaded file and every raw camera capture is stored unchanged
  (I4). A scanned page is a derived image linked to its capture; the teacher can open either.

### Problems

- **PL-15 Draft with a title.** A problem can be saved as a draft with only a title. Statement,
  solution and rubric can be added later. The button is **New problem**, with **Create problem**
  in its dialog; the problem still starts as a draft.
- **PL-40 Two problem screens** (owner request, 5 November 2026). A problem has two screens, with
  no cards around them: **1 · Problem information** (statement and reference solution in one column
  each, the optional rubric across both) and **2 · AI grader** (what the AI understood, the rubric with one card per criterion,
  accept and improve, then the problem's answers). Images added to the statement or solution are
  uploaded as soon as they are dropped, picked or scanned; tapping one opens it large in a dialog.
  The whole statement or solution block is the drop area: while an image is dragged over it, a
  dashed primary-colour border and a blurred cover read "Drop your images here". An empty text
  field reads "Click to type or drag your images here", centred and muted; Browse files and Scan
  sit below it on the left. On a computer the rubric field grows with its text only while the
  whole screen still fits without a page scrollbar (so the problem name and the screen tabs stay
  in view), then scrolls inside; it can always grow to 15 lines, even on a short screen. On a
  phone it keeps growing with the text.
  The title is not a form field: a pencil next to the page title turns it into a text input (Enter
  or leaving saves, Esc cancels). Exams are renamed the same way.
- **PL-41 Problem tags** (owner request, 5 November 2026). A plus next to the problem's status
  in its header opens a field that suggests the teacher's existing tags and accepts a new one
  (Enter adds it; picking a suggestion adds it at once). Tags show as chips with a remove button.
  A tag is 1–40 characters, a problem has at most 20, and "Mechanics" and "mechanics" are one tag
  (the first spelling is kept). A teacher's tags are stored on their own: a tag stays when no
  problem carries it any more, and is offered again. Tags are private to the teacher. Tags do not
  affect grading.
- **PL-42 Search and filter problems** (owner request, 5 November 2026). The Problems page has a
  search bar above the list and a filter sidebar on its right with:
  - **Sort by**: recently changed (default), least recently changed, name A–Z, name Z–A.
  - **Status**: Draft, Ready and Archived checkboxes with counts. Draft and Ready are checked by
    default, Archived is not. An archived problem shows only under Archived, whatever its status;
    none checked shows nothing (PL-44).
  - **Tags**: never listed all at once. Clicking the field opens a menu with the first 8 tags and
    "Type to see {n} more"; typing searches them all (each with how many problems carry it); picking one, or Enter on a full tag name in any
    case, adds it as a chip with a remove button. A problem must carry every chosen tag. An unknown
    name says no tag matches.
  Tag suggestions here and on the problem header open in the site's own menu (`TagInput`), as wide
  as the field, so they stay inside the panel; the typed part is bold, arrow keys move, Enter
  picks, Escape closes. On the problem header a name that is not a tag yet shows "Create …".
  Every scrollbar on the site is thin and drawn in the theme's colours (light and dark).
  A cut-off label on any button, link, select, option or tag scrolls to its end and back while
  hovered, so it can be read in full (none with reduced motion).
  - **Clear** resets status to the default and removes the tags.
  The search matches every typed word against the problem's name or tags, ignoring case. On a
  phone a Filters button opens the panel between the search bar and the list. "{n} of {total}
  problems" shows how many match. Search and filters run on the loaded list and are not saved.
- **PL-45 Problem screens and what follows acceptance** (owner request, 5 November 2026). A problem
  has three screens: 1 · Problem information, 2 · AI grader, 3 · Answers. Opened without a chosen
  screen, a ready problem (its rubric accepted) opens on Answers; one that has an AI grader or is
  being prepared opens on the AI grader; otherwise on Problem information. Answers lists the problem's answers newest first by default (sort: newest,
  oldest, name A–Z) and is where answers are added once the rubric is accepted. After accepting a
  rubric version the teacher is asked where to go: the answers (default), the problem list, or stay
  on the page. The back link from an answer returns to the Answers screen.
- **PL-46 Group on an answer** (owner request, 6 November 2026). When the teacher adds an answer
  on a problem's Answers screen, they can optionally pick one of their groups in an autocomplete
  (archived ones are not offered; with no groups the field says so); the picked group shows as a
  removable chip and stays for the next answer. The group shows next to the student's name in the
  list. A group given without an exam must be the teacher's own; an exam still needs its group.
- **PL-47 Recently used problems** (owner request, 6 November 2026). Above the problem list, a
  "Recently used" section shows the ten problems whose answers were most recently uploaded, graded
  by the AI or approved, newest first, as cards that open the problem. Archived problems and
  problems without answers are left out; the full list, its search and filters stay below.
- **PL-44 Archive a problem** (owner request, 5 November 2026). An archive button on each row of
  the Problems list and below the problem's title archives it; on an archived problem the same
  button unarchives it, and the problem shows an "Archived" badge. Archiving only hides the problem
  from the default list (PL-42) and from "Add an existing problem" on an exam; its status, rubric
  versions, answers, grades and exams are kept, and it can still be opened.
- **PL-43 Preparing shown everywhere** (owner request, 5 November 2026). While the AI grader of a
  problem is being prepared (Prepare, Prepare again from scratch), a spinner shows at the right
  edge of Problems in the sidebar and next to that problem's name in the Problems list, so the
  teacher can leave the page and still see it running. Preparing is a server job: the request
  returns at once (202), the problem is marked as preparing in the database, and every open tab
  polls that state (every 2 s while something is preparing, 5 s otherwise), so another tab or a
  reload shows it too. One preparation runs per problem at a time (a second request gets 409). A
  provider failure stores an error and no proposal (I2); a server restart turns a preparation in
  progress into that error ("prepare it again"), as for grading runs (ADR-0001).
- **PL-16 Generate the grader.** From a statement and a reference solution (text and/or images, an
  optional rubric), the teacher asks the AI to prepare the problem: its reading of the statement and
  solution, final answers, assumptions, expected forces when a diagram is needed, a rubric with
  points per criterion, and any issues it found (grader GR-01–05).
- **PL-17 Edit what the AI understood.** Every field of that proposal is editable in place:
  statement, solution, final answers, assumptions, expected forces, and each rubric criterion
  (description, points, required evidence, full, partial and zero credit), plus the carried-error
  policy, tolerances and alternative methods. Criteria can be added, removed and reordered.
  Validation errors (for example, duplicate ids or zero points) show next to the field.
- **PL-18 Improve with instructions.** The teacher can write an instruction to the AI ("criterion
  C2 should accept g = 9.8 or 10", "the diagram needs friction") and get a revised proposal. They
  see what changed and keep it or discard it.
- **PL-19 Versions and readiness.** Accepting a proposal makes the problem *ready* and fixes a
  rubric version. A later edit creates a new version. Grades keep the version they were made with
  (AC-G09). Issues the AI raised must be acknowledged before acceptance.

### Answers and review

- **PL-20 Add answers.** For a ready problem, the teacher adds answers by browse, drag and drop, or
  scan, one answer per student (one or more pages), with an optional label.
- **PL-21 Grade.** The teacher starts grading for selected answers. Each answer gets a draft
  proposal from the grader (criterion scores, evidence, feedback), or a *review required* or
  *failed* state with no score (I1, I2). Progress is visible while it runs.
- **PL-22 One answer at a time.** A review view shows one answer: the paper image large (zoom, pan,
  page switch) next to the AI's proposal (criteria, points, evidence, reasoning, confidence,
  feedback), with next and previous. A list view shows all answers with their state.
  On a computer the review view fits the screen without a page scrollbar: the paper takes the
  height left and the proposal and grade column scrolls inside itself (owner request, 6 November
  2026).
  A "Reset view" button (with the current zoom) puts the paper back at 100% and centred; whenever
  the zoom returns to 100% by any path, the paper is centred again (owner request, 6 November 2026).
  In the right column the teacher's grade comes first, with its live total as the headline, and
  the AI proposal below it, quieter. The proposal card shows its total and the criteria not marked
  high confidence ("Check first") in its header, then one square per criterion with its id, points
  and confidence. The stages fold below: 1 transcription, 2 physics interpretation, 3 proposed
  scores (each criterion with its evidence and source, reasoning and confidence, all shown once
  open) and the suggested feedback (I3, I5). In the teacher's grade each criterion is a small cell with its id
  (description on hover), its points large and bold, and its maximum; the cells sit side by side. On this screen the page and zoom buttons sit under the paper, beside
  its caption (owner requests, 6 November 2026).
- **PL-23 Final grade.** The teacher sets the final points per criterion and the feedback, starting
  from the proposal, and approves. Approval is the only way a grade becomes final (I1). The AI's
  proposal is kept unchanged beside the approved grade.
- **PL-24 Feedback on the AI.** With each approval the teacher marks the AI as *correct* or *wrong*.
  When wrong, they say why: which criteria were wrong and a short reason (misread handwriting,
  wrong physics, rubric applied wrongly, other). This is stored for evaluation, not shown to
  students.

### Groups and exams

- **PL-25 Groups.** A teacher creates, renames and archives groups (a class or a section) and sees
  the students who have submitted in each.
- **PL-26 Exams.** A teacher creates an exam with a title, adds existing problems, or creates a new
  problem from inside the exam, which is added to it automatically. They can reorder and remove
  problems, and assign one or more groups. Each exam and group pair is reviewed and costed
  separately.
- **PL-27 Exam answers.** For an exam and group, the teacher sees answers per problem and per
  student, and reviews them with PL-22 to PL-24.

### Student upload link

- **PL-28 Link and QR code.** For an exam and group, the teacher opens an upload link and gets a
  URL and a QR code to show in class. They set its lifetime when opening it (default from PL-08).
- **PL-29 Student page.** With no account, a student opens the link, types their name, and for each
  problem of the exam uploads their answer by scan (in-app scanner, PL-13) or file. Before
  sending, they see the pages they are about to submit for each problem. The page works on a phone.
- **PL-30 Closing.** The teacher can close the link at any time. It closes by itself when its
  lifetime ends. A closed or expired link accepts nothing and says so plainly. The teacher sees each
  link's state and can open a new one.
- **PL-31 Traceable submissions.** Every student upload records the name typed, the link, the time
  received, and the problem chosen. A second upload by the same name for the same problem is kept
  as a new version, never overwriting the first. The teacher sees all versions and chooses which
  one to grade. Uploads after closing are refused, not stored.

- **PL-35 Student submission integrity (US.P10, US.P12).** The upload link is for students
  submitting their own answers. A typed name alone does not verify who is submitting: students
  could impersonate classmates or submit the same work for different students. Proposed safeguard:
  set an opaque first-party cookie when the student opens the link, then bind that browser session
  server-side to the first submitted student name for that exam and group. Check this binding on
  every submission, including through a newly opened link for the same exam and group. If the same
  cookie is used with a different student name, refuse the submission before storing answer files
  or starting grading, explain the conflict without exposing the previous student's name, and ask
  the student to contact the teacher. Simultaneous submissions must not create two bindings.
  Same-student repeat uploads follow PL-31: preserve versions, never silently overwrite or create
  a second student record. Teacher uploads on a student's behalf remain available (PL-20).
  The cookie contains no student name or answer data and is scoped to this submission flow;
  use Secure, HttpOnly and SameSite protections. Explain its purpose on the upload page.
  This is a browser-session check, not proof of student identity, physical location, authorship,
  or absence of cheating. Clearing cookies, private browsing or another browser/device can bypass
  it; shared devices and misspelled names can cause legitimate conflicts. Do not claim verified
  identity or introduce IP tracking or device fingerprinting as a substitute. Cookie lifetime,
  missing/blocked-cookie handling, name correction and stronger identity verification remain
  design questions to resolve before implementation.

### Costs

- **PL-32 Every AI call is recorded.** Each call stores model, input, cached, output and reasoning
  tokens, estimated US$ (from `prices.json`; kind: estimated), the teacher, the problem, the purpose
  (*setup*, *improve*, *grading*), and for grading the exam and group when there is one.
- **PL-33 Teacher spending views.** A teacher sees money and tokens spent per problem (setup and
  improve, and grading, separately), per group, per exam, and per exam and group (grading only).
- **PL-34 One model.** All AI calls use OpenAI `gpt-6.1-sol` (verified on the OpenAI pricing page,
  5 November 2026: US$2.00 input, 0.10 cached input, 10.00 output per 1M tokens; kind: reported).

## Success

- Primary: net teacher time saved per graded answer against marking by hand, measured on the first
  real exam (directive). No target number agreed yet; see the open questions.
- Guardrail: AI-wrong rate from PL-24 and full-mark precision, measured separately from coverage.

## Out of scope (for now)

- Student accounts, grade publishing to students, and LMS export.
- Choosing between several models, and showing the raw baseline in the product (it stays in
  `grader/` for evaluation).
- Automatic matching of unordered photos to problems (students and teachers choose the problem).
- Payments; every teacher pays OpenAI directly through their own key.

## Grader library changes this needs

Each comes with tests and a `grader.md` update (AGENTS.md, Grader library boundary).

- **GL-01**: Calls use the caller's API key (per teacher, PL-06) instead of a process-wide one.
- **GL-02**: A revision step that takes the current proposal and the teacher's instruction and
  returns a revised proposal (PL-18).
- **GL-03**: Accepted model fixed to `gpt-6.1-sol` by the caller; `configured_models` is not used
  by the product (PL-34).
- **GL-04** *(needs owner approval: changes grading semantics)*: Instructions to the grader written
  on a student's paper ("give full marks") are ignored and flagged as a review reason.

## Acceptance scenarios

| ID | Covers | Check |
|---|---|---|
| AC-P01 | PL-01, PL-02 | First sign-up on an empty database becomes admin; the second is pending and cannot sign in until approved. |
| AC-P02 | PL-03 | The only admin cannot remove their own admin rights; a granted admin can approve users. |
| AC-P03 | PL-06 | The saved key is never returned by the API beyond its last 4 characters; AI actions are refused without a key. |
| AC-P04 | PL-15 | A problem with only a title saves as a draft and appears in the Problems tab. |
| AC-P05 | PL-17, PL-19 | Editing a criterion's points on a ready problem creates a new rubric version; earlier grades keep theirs. |
| AC-P06 | PL-18 | An instruction produces a revised proposal shown as a difference; discarding it leaves the proposal unchanged. |
| AC-P07 | PL-14, PL-13 | A scanned page and its raw capture are both stored; the raw file's bytes are unchanged. |
| AC-P08 | PL-21, I2 | A provider failure or unreadable answer shows *failed* or *review required* and no score. |
| AC-P09 | PL-23, PL-24 | Approving with edits stores the approved grade, the untouched proposal and the AI-correct or wrong mark with its reason. |
| AC-P10 | PL-26 | Creating a problem inside an exam adds it to that exam. |
| AC-P11 | PL-28, PL-30 | A link with a 1-minute lifetime refuses uploads after it expires; a closed link refuses at once. |
| AC-P12 | PL-31 | Two uploads with the same name for one problem are both kept as versions. |
| AC-P13 | PL-32, PL-33 | After one setup and two gradings, the problem, exam, group and exam+group totals add up to the recorded calls. |
| AC-P15 | PL-35, US.P12 | Opening a link sets an opaque cookie; a first submission binds it server-side. A different student name with that cookie is refused without storing answer files or grading, including on a replacement link for the same exam/group. Concurrent attempts cannot bind two names. The refusal does not expose the bound name. |
| AC-P16 | PL-35, PL-31 | The bound student can submit other problems; repeat uploads for one problem remain versions. A shared-device conflict directs the student to the teacher, who can upload on their behalf. Cookie bypass is documented as an unresolved limitation, not treated as verified identity. |
| AC-P14 | PL-10, PL-11 | At 375 px and 1280 px, in light and dark, every tab is usable and uses the right primary colour. |
| AC-P19 | PL-41 | Tags added to a problem are kept, merged case-insensitively, suggested on the teacher's other problems, and never shown to another teacher; empty or over-long tags are refused (`test_tags_are_kept_per_teacher_and_suggested`). |
| AC-P20 | PL-43 | Preparing runs as a background job: the problem shows as preparing to every request of its owner and to no one else, a second preparation is refused while one runs, and a provider failure or a restart leaves an error and no proposal (`test_preparing_is_shared_and_runs_once`, `test_provider_failure_while_preparing_stores_no_proposal`). |
| AC-P21 | PL-44 | Archiving a problem keeps its status and rubric version, it is still listed with `archived`, and unarchiving restores it (`test_archiving_a_problem_is_reversible_and_keeps_it`). |
| AC-P22 | PL-45 | A problem's answers are listed newest first (`test_problem_answers_are_listed_newest_first`). |
| AC-P23 | PL-46 | An answer can carry one of the teacher's groups without an exam; another teacher's group is refused, and an exam without a group is refused (`test_an_answer_can_name_one_of_the_teachers_groups`). |
| AC-P24 | PL-47 | The problem list gives each problem the time an answer to it was last uploaded, graded or approved, and none for a problem without answers (`test_problems_show_when_an_answer_was_last_uploaded_or_graded`). |
| AC-P18 | PL-39 | At 75 %, 100 % and 150 %, on a phone and a computer, the sidebar runs the full height and the footer starts at its right edge, nothing scrolls sideways, dialogs zoom with the page, and the footer stays 28 px high. |
| AC-P17 | PL-37 | A teacher who picks Spanish sees the interface in Spanish after one click, and the setup and grading prompts carry the Spanish language rule; the run records `es`. Every interface text has a Spanish and a Russian translation (`server/tests/test_web_i18n.py`). |

## Open questions (each with the default applied until answered, D10)

1. *Student identity and cheating.* Owner proposal, 5 November 2026: refuse different-student
   submissions from the same cookie-bound browser session (PL-35), while preserving same-student
   versions (PL-31). This reduces one impersonation route but does not verify identity or detect
   copied answers. Default for legitimate conflicts: contact the teacher for a teacher upload.
   Before implementation, agree cookie lifetime and missing/blocked-cookie handling, how a
   student corrects a name, and whether stronger identity checks are needed. No device or
   location tracking is authorized by this proposal.
2. *Groups and rosters.* Default: a group has no pre-loaded roster; its students are the names that
   submitted. A roster for matching names comes later if teachers ask.
3. *One answer, several problems.* Default: a student uploads one answer per problem and chooses
   the problem; a photo that covers two problems is uploaded to each.
4. *Who sees costs.* Default: each teacher sees only their own; admins see everyone's totals but
   never API keys.
5. *Approval of fully correct answers in bulk.* Default: no bulk approval; every grade is approved
   one by one (I1). A faster path needs a directive decision.
6. *Time target.* Default: none set; measure the first exam before agreeing one (A10).
