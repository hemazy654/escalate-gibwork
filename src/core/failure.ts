import { z } from 'zod';
export const reportSchema = z.object({
  task: z.string().min(1).max(4000),
  files: z.array(z.string().max(300)).max(100).default([]),
  attempts: z.array(z.object({ summary: z.string().min(1).max(4000), outcome: z.enum(['pass','fail']), output: z.string().max(32000).default('') }).strict()).min(1).max(100)
}).strict();
export type FailureReport = z.infer<typeof reportSchema>;
export function detect(report: FailureReport, threshold = 3) {
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > 100) throw new Error('Threshold must be an integer from 2 to 100');
  let consecutive = 0;
  for (const attempt of report.attempts) consecutive = attempt.outcome === 'fail' ? consecutive + 1 : 0;
  return { escalate: consecutive >= threshold, consecutive, threshold };
}
