import type { Lang } from "./i18n";

/** Thin fetch wrapper: cookies included, server `detail` surfaced as the error message. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "include" };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  const r = await fetch(url, init);
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const d = data.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join("; ") : r.statusText;
    throw new ApiError(r.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T,>(u: string) => call<T>("GET", u),
  post: <T,>(u: string, b?: unknown) => call<T>("POST", u, b ?? {}),
  put: <T,>(u: string, b: unknown) => call<T>("PUT", u, b),
  patch: <T,>(u: string, b: unknown) => call<T>("PATCH", u, b),
  del: <T,>(u: string) => call<T>("DELETE", u),
  form: <T,>(u: string, f: FormData) => call<T>("POST", u, f),
};

export const fileUrl = (id: string) => `/api/files/${id}`;

/** A page to upload: the image sent for grading, and the raw camera capture it came from. */
export type Page = { file: Blob; name: string; capture?: Blob; preview: string };

export function pagesForm(pages: Page[], extra: Record<string, string | undefined> = {}) {
  const f = new FormData();
  pages.forEach((p, i) => {
    f.append("pages", p.file, p.name);
    if (p.capture) {
      f.append("captures", p.capture, `capture-${i + 1}.jpg`);
      f.append("capture_of", String(i));
    }
  });
  for (const [k, v] of Object.entries(extra)) if (v) f.append(k, v);
  return f;
}

export type Me = { id: string; email: string; name: string; is_admin: boolean; theme: Theme; language: Lang; fake_llm: boolean };
export type Theme = "system" | "light" | "dark";

export type Criterion = {
  id: string; description: string; max_points: number; required_evidence: string;
  full_credit: string; partial_credit: string; zero_credit: string;
};
export type Rubric = {
  criteria: Criterion[]; carried_error_policy: string; tolerances: string; alternative_methods: string;
};
export type Proposal = {
  normalized_statement: string; normalized_solution: string; final_answers: string[];
  assumptions: string[]; diagram_required: boolean; expected_forces: string[]; rubric: Rubric;
  grading_plan: string[]; issues: string[];
};
export type FileRef = { id: string; kind: "original" | "capture" | "scan"; derived_from: string | null; name: string };
export type Problem = {
  id: string; title: string; status: "draft" | "ready"; language: string;
  statement_text: string; solution_text: string; rubric_text: string;
  proposal: Proposal | null; pending_proposal: Proposal | null; pending_instruction: string | null;
  rubric_version: number; rubric_errors: string[]; tags: string[];
  preparing: boolean; prepare_error: string | null;  // PL-43
  archived: boolean;  // PL-44
  files: (FileRef & { link_id: number; role: "statement" | "solution" })[]; answers: number;
};
export type AnswerState = "not_graded" | "running" | "proposed" | "review_required" | "failed" | "approved";
export type AnswerRow = {
  id: string; problem_id: string; exam_id: string | null; group_id: string | null;
  student_name: string; label: string; source: "teacher" | "student"; version: number;
  selected: boolean; created_at: string; state: AnswerState; proposed_total: number | null;
  max_points: number | null; approved_total: number | null;
};
export type CriterionScore = {
  criterion_id: string; points: number; source: string; evidence: string; reasoning: string;
  confidence: "high" | "medium" | "low";
};
export type Harness = {
  status: string; transcription: string; interpretation: string; diagram_observations: string;
  criteria: CriterionScore[]; feedback: string; review_reasons: string[];
};
export type RunOut = {
  id: string; status: AnswerState; total: number | null; max_points: number; rubric_version: number;
  harness: Harness | null; error: string | null; language: Lang | null; started_at: string; finished_at: string | null;
};
export type Approval = {
  run_id: string | null; scores: { criterion_id: string; points: number }[]; feedback: string;
  total: number; edited_criteria: string[]; ai_verdict: "correct" | "wrong" | null;
  wrong_criteria: string[]; wrong_reason: string | null; wrong_note: string; approved_at: string;
};
export type AnswerDetail = AnswerRow & {
  problem_title: string; pages: FileRef[]; rubric_version: number; rubric: Rubric | null;
  runs: RunOut[]; approval: Approval | null;
  versions: { id: string; version: number; selected: boolean; created_at: string }[];
};
export type Group = { id: string; name: string; archived: boolean; students: string[]; created_at: string;
  last_used_at: string;  // PL-51: created, or an answer in it uploaded, graded or approved
};
/** PL-51: a group's page; each problem counts the group's answers and lists those ready to grade. */
export type GroupDetail = Group & {
  exams: Exam[];
  problems: { id: string; title: string; status: string; archived: boolean; rubric_version: number; tags: string[]; updated_at: string;
    answers: number; approved: number; to_grade: string[] }[];
};
export type Exam = {
  id: string; title: string; created_at: string;
  archived: boolean; last_used_at: string;  // PL-56: created, opened, or an answer in it used
  problems: { id: string; title: string; status: string; active: boolean }[];  // PL-55: off, students can't pick it
  // PL-55: students who uploaded an answer, in all and per problem id
  groups: { id: string; name: string; students: number; per_problem: Record<string, number> }[];
};
export type Link = {
  id: string; url: string; state: "open" | "closed" | "expired"; created_at: string;
  expires_at: string; closed_at: string | null;
};
