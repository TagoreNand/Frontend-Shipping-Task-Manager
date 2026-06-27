import { readFileSync } from 'node:fs';
import type { ModelArtifact } from './types';

export function loadModel(filePath: string): ModelArtifact {
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as ModelArtifact;
  if (!Array.isArray(parsed.classes) || typeof parsed.weights !== 'object' || parsed.weights === null) {
    throw new Error(`Invalid model artifact at ${filePath}`);
  }
  return parsed;
}
