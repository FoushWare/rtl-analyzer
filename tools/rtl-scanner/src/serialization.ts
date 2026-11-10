import type { SchemaV2PresentationReport } from './presentation-adapter.js';

export type ReportFormat = 'json' | 'markdown';

/** Future serializer contract; Milestone 1 deliberately provides no renderer. */
export interface ReportSerializer<TOutput = string> {
  readonly format: ReportFormat;
  serialize(report: SchemaV2PresentationReport): TOutput;
}

export interface ReportSerializerRegistry {
  get(format: ReportFormat): ReportSerializer;
}
